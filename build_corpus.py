import gzip
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path
from urllib.request import urlretrieve

DATA_URL = "https://huggingface.co/datasets/globis-university/aozorabunko-clean/resolve/main/aozorabunko-dedupe-clean.jsonl.gz"
RAW_FILE = Path("aozorabunko-dedupe-clean.jsonl.gz")

DATA_DIR = Path("src/data")
OUTPUT_FILE = DATA_DIR / "passages.json"
FULL_CORPUS_FILE = DATA_DIR / "full_text_corpus.json"

# Corpus size tuning
MAX_BOOKS = 300
TARGET_PASSAGES = 500

# Passage tuning
MIN_CHARS = 250
TARGET_CHARS = 700
MAX_CHARS = 950

# Quality filters
MAX_NEWLINES_RATIO = 0.18
MIN_JAPANESE_CHAR_RATIO = 0.55

# If True, only keep 新字新仮名 for passages.json
MODERN_ONLY_FOR_PASSAGES = True

# If True, full_text_corpus.json will analyze all rows
# If False, it will only analyze rows that pass the modern filter
FULL_CORPUS_USE_ALL_ROWS = True


def download_file():
    if RAW_FILE.exists():
        print(f"Using existing file: {RAW_FILE}")
        return

    print("Downloading dataset...")
    urlretrieve(DATA_URL, RAW_FILE)
    print("Download complete.")


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\u3000]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_into_paragraphs(text: str):
    parts = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if parts:
        return parts
    return [p.strip() for p in text.split("\n") if p.strip()]


def split_sentences(text: str):
    return [s.strip() for s in re.split(r"(?<=[。！？])", text) if s.strip()]


def build_passages(paragraphs):
    passages = []
    current = ""

    def flush():
        nonlocal current
        if current.strip():
            passages.append(current.strip())
        current = ""

    for para in paragraphs:
        units = [para] if len(para) <= MAX_CHARS else split_sentences(para)

        for unit in units:
            unit = unit.strip()
            if not unit:
                continue

            candidate = f"{current}\n\n{unit}".strip() if current else unit

            if len(candidate) <= TARGET_CHARS:
                current = candidate
            elif len(current) >= MIN_CHARS:
                flush()
                current = unit
            elif len(candidate) <= MAX_CHARS:
                current = candidate
            else:
                if current:
                    flush()

                if len(unit) <= MAX_CHARS:
                    current = unit
                else:
                    for i in range(0, len(unit), MAX_CHARS):
                        chunk = unit[i:i + MAX_CHARS].strip()
                        if len(chunk) >= MIN_CHARS:
                            passages.append(chunk)
                    current = ""

    if current.strip():
        flush()

    return passages


def japanese_char_ratio(text: str) -> float:
    if not text:
        return 0.0
    jp_chars = re.findall(r"[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff々〆ヵヶ]", text)
    return len(jp_chars) / max(len(text), 1)


def looks_good(text: str) -> bool:
    if len(text) < MIN_CHARS:
        return False

    newline_ratio = text.count("\n") / max(len(text), 1)
    if newline_ratio > MAX_NEWLINES_RATIO:
        return False

    if japanese_char_ratio(text) < MIN_JAPANESE_CHAR_RATIO:
        return False

    if re.search(r"(底本|入力：|校正：|青空文庫)", text):
        return False

    return True


def estimate_minutes(text: str) -> int:
    return max(3, min(10, math.ceil(len(text) / 350)))


def count_kanji(text: str) -> int:
    return len(re.findall(r"[一-龯々]", text))


def count_sentences(text: str) -> int:
    parts = re.split(r"[。！？]", text)
    return max(1, len([p for p in parts if p.strip()]))


def infer_difficulty(text: str) -> str:
    char_count = len(text)
    kanji_count = count_kanji(text)
    sentence_count = count_sentences(text)

    kanji_ratio = kanji_count / max(char_count, 1)
    avg_sentence_len = char_count / sentence_count

    score = 0

    if char_count > 850:
        score += 2
    elif char_count > 500:
        score += 1

    if kanji_ratio > 0.22:
        score += 2
    elif kanji_ratio > 0.16:
        score += 1

    if avg_sentence_len > 50:
        score += 2
    elif avg_sentence_len > 30:
        score += 1

    if score <= 1:
        return "easy"
    elif score <= 3:
        return "normal"
    return "hard"


def modern_only(meta: dict) -> bool:
    return meta.get("文字遣い種別") == "新字新仮名"


def extract_title(meta: dict) -> str:
    candidate_keys = [
        "作品名",
        "title",
        "タイトル",
        "作品",
        "name",
    ]
    for key in candidate_keys:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Untitled"


def extract_author(meta: dict) -> str:
    sei = (meta.get("姓") or meta.get("著者姓") or "").strip()
    mei = (meta.get("名") or "").strip()
    if sei or mei:
        return f"{sei}{mei}".strip()

    candidate_keys = [
        "姓名",
        "著者名",
        "著者",
        "作者名",
        "作家名",
        "人物",
        "name",
        "author",
    ]
    for key in candidate_keys:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return "Unknown"


def extract_writing_type(meta: dict) -> str:
    return (meta.get("文字遣い種別") or "Unknown").strip()


def author_theme_hint(author: str):
    hints = {
        "夏目漱石": "literature",
        "芥川龍之介": "literature",
        "太宰治": "literature",
        "森鴎外": "literature",
        "宮沢賢治": "children",
        "福沢諭吉": "society",
        "岡本綺堂": "mystery",
        "新美南吉": "children",
    }
    return hints.get(author)


def infer_theme(title: str, text: str, author: str = "") -> str:
    sample = f"{title}\n{text[:1200]}\n{author}"

    theme_rules = {
        "history": ["歴史", "戦", "幕府", "武士", "明治", "時代", "城", "将軍", "維新", "皇"],
        "daily-life": ["家", "母", "父", "学校", "先生", "友達", "朝", "夜", "ご飯", "日常", "家庭"],
        "society": ["社会", "文明", "文化", "政治", "経済", "国家", "民衆", "教育", "思想"],
        "work": ["会社", "仕事", "労働", "職業", "商売", "銀行", "工場", "事務", "営業"],
        "travel": ["旅", "道", "海", "山", "温泉", "駅", "宿", "汽車", "東京", "京都"],
        "literature": ["小説", "物語", "詩", "文学", "短編", "随筆"],
        "mystery": ["事件", "謎", "怪", "探偵", "殺", "秘密", "不思議"],
        "philosophy": ["人生", "哲学", "心", "精神", "存在", "善", "悪", "真理"],
        "nature": ["春", "夏", "秋", "冬", "花", "風", "雨", "雪", "月", "森", "川"],
        "war": ["戦争", "兵", "軍", "戦場", "爆", "敵", "敗戦"],
        "humor": ["滑稽", "笑", "冗談", "おかしい", "喜劇"],
        "children": ["子供", "少年", "少女", "童話", "昔話"],
    }

    scores = {theme: 0 for theme in theme_rules}
    for theme, keywords in theme_rules.items():
        for kw in keywords:
            scores[theme] += sample.count(kw)

    best_theme = max(scores, key=scores.get)
    if scores[best_theme] == 0:
        return "general"
    return best_theme


def make_record(book_index: int, passage_index: int, title: str, author: str, passage: str):
    hint = author_theme_hint(author)
    theme = hint if hint else infer_theme(title, passage, author)
    difficulty = infer_difficulty(passage)

    return {
        "id": f"aozora-{book_index}-{passage_index}",
        "source": "aozora",
        "title": title,
        "author": author,
        "theme": theme,
        "difficulty": difficulty,
        "estimatedMinutes": estimate_minutes(passage),
        "text": passage,
        "questions": []
    }


def print_meta_sample(meta: dict, count: int):
    print(f"\n--- META SAMPLE {count} ---")
    print(json.dumps(meta, ensure_ascii=False, indent=2))


def update_full_corpus_stats(stats, title: str, author: str, writing_type: str):
    stats["total_books"] += 1
    stats["authors_set"].add(author)
    stats["books_per_author"][author] += 1
    stats["works_counter"][title] += 1
    stats["authors_counter"][author] += 1
    stats["writing_type_distribution"][writing_type] += 1


def build_full_corpus_payload(stats):
    all_authors_sorted = sorted(stats["authors_set"])

    books_per_author_sorted = [
        {"author": author, "book_count": count}
        for author, count in sorted(stats["books_per_author"].items(), key=lambda x: (-x[1], x[0]))
    ]

    top_works = [
        {"title": title, "count": count}
        for title, count in stats["works_counter"].most_common(50)
    ]

    top_authors = [
        {"author": author, "count": count}
        for author, count in stats["authors_counter"].most_common(50)
    ]

    writing_type_distribution = [
        {"writing_type": writing_type, "count": count}
        for writing_type, count in stats["writing_type_distribution"].most_common()
    ]

    return {
        "total_books": stats["total_books"],
        "total_unique_authors": len(stats["authors_set"]),
        "all_authors": all_authors_sorted,
        "books_per_author": books_per_author_sorted,
        "top_works": top_works,
        "top_authors": top_authors,
        "writing_type_distribution": writing_type_distribution,
    }


def main():
    download_file()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    results = []
    processed_books_for_passages = 0
    debug_samples = 0

    full_corpus_stats = {
        "total_books": 0,
        "authors_set": set(),
        "books_per_author": defaultdict(int),
        "works_counter": Counter(),
        "authors_counter": Counter(),
        "writing_type_distribution": Counter(),
    }

    with gzip.open(RAW_FILE, "rt", encoding="utf-8") as f:
        for line in f:
            row = json.loads(line)

            meta = row.get("meta", {})
            title = extract_title(meta)
            author = extract_author(meta)
            writing_type = extract_writing_type(meta)

            if FULL_CORPUS_USE_ALL_ROWS or modern_only(meta):
                update_full_corpus_stats(full_corpus_stats, title, author, writing_type)

            if MODERN_ONLY_FOR_PASSAGES and not modern_only(meta):
                continue

            if debug_samples < 3:
                print_meta_sample(meta, debug_samples + 1)
                debug_samples += 1

            text = normalize_text(row.get("text", ""))
            if not text:
                continue

            paragraphs = split_into_paragraphs(text)
            passages = build_passages(paragraphs)

            for i, passage in enumerate(passages):
                if not looks_good(passage):
                    continue

                results.append(
                    make_record(processed_books_for_passages, i, title, author, passage)
                )

                if len(results) >= TARGET_PASSAGES:
                    break

            processed_books_for_passages += 1

            if processed_books_for_passages >= MAX_BOOKS or len(results) >= TARGET_PASSAGES:
                continue

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    full_corpus_payload = build_full_corpus_payload(full_corpus_stats)
    with open(FULL_CORPUS_FILE, "w", encoding="utf-8") as f:
        json.dump(full_corpus_payload, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Wrote {len(results)} passages to {OUTPUT_FILE}")
    print(f"Done. Wrote corpus stats to {FULL_CORPUS_FILE}")

    author_counts = {}
    theme_counts = {}
    difficulty_counts = {}

    for item in results:
        author_counts[item["author"]] = author_counts.get(item["author"], 0) + 1
        theme_counts[item["theme"]] = theme_counts.get(item["theme"], 0) + 1
        difficulty_counts[item["difficulty"]] = difficulty_counts.get(item["difficulty"], 0) + 1

    print("\nTop authors in passages:")
    for author, count in sorted(author_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {author}: {count}")

    print("\nThemes in passages:")
    for theme, count in sorted(theme_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {theme}: {count}")

    print("\nDifficulty in passages:")
    for difficulty, count in sorted(difficulty_counts.items(), key=lambda x: x[1], reverse=True):
        print(f"  {difficulty}: {count}")

    print("\nTop authors in full corpus:")
    for item in full_corpus_payload["top_authors"][:10]:
        print(f"  {item['author']}: {item['count']}")

    print("\nWriting type distribution:")
    for item in full_corpus_payload["writing_type_distribution"]:
        print(f"  {item['writing_type']}: {item['count']}")


if __name__ == "__main__":
    main()