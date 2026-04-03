import gzip
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.request import urlretrieve

DATA_URL = "https://huggingface.co/datasets/globis-university/aozorabunko-clean/resolve/main/aozorabunko-dedupe-clean.jsonl.gz"
RAW_FILE = Path("aozorabunko-dedupe-clean.jsonl.gz")

DATA_DIR = Path("src/data")
FULL_CORPUS_FILE = DATA_DIR / "full_text_corpus.json"
PASSAGES_FILE = DATA_DIR / "passages.json"
CURATED_SUMMARY_FILE = DATA_DIR / "curated_corpus_summary.json"

# ===== OUTPUT SIZE =====
TARGET_PASSAGES = 2000

# ===== PASSAGE SPLIT =====
MIN_CHARS = 280
TARGET_CHARS = 850
MAX_CHARS = 1000

MAX_NEWLINES_RATIO = 0.18
MIN_JAPANESE_CHAR_RATIO = 0.55

# ===== FILTERING =====
ALLOW_MODERN = True
ALLOW_MIXED_NEW_KANJI_OLD_KANA = True
ALLOW_HISTORICAL_FOR_FAVORITES = False

MAX_PASSAGES_PER_AUTHOR = 120
MAX_PASSAGES_PER_WORK = 24
MAX_PASSAGES_PER_THEME = 700
MAX_PASSAGES_PER_DECADE = 500

MAX_PASSAGES_PER_DIFFICULTY = {
    "easy": 500,
    "normal": 1100,
    "hard": 400,
}

# ===== USER TASTE =====
FAVORITE_JAPANESE_AUTHORS = {
    "夏目漱石",
    "芥川竜之介",
    "芥川龍之介",
    "森鴎外",
    "太宰治",
    "中島敦",
    "宮沢賢治",
    "岡本綺堂",
    "寺田寅彦",
    "和辻哲郎",
    "三木清",
    "柳田国男",
}

FAVORITE_FRENCH_OR_EURO_AUTHORS = {
    "モーパッサンギ・ド",
    "ユゴーヴィクトル",
    "ルブランモーリス",
    "ボードレールシャルル・ピエール",
    "ランボージャン・ニコラ・アルチュール",
    "デカルトルネ",
    "パスカルブレーズ",
    "ロランロマン",
    "ヴァレリーポール",
    "マラルメステファヌ",
    "ペローシャルル",
    "ミュッセアルフレッド",
    "クローデルポール",
    "ルナールジュール",
    "ロティピエール",
}

PREFERRED_THEMES = {
    "literature": 1.6,
    "history": 1.35,
    "mystery": 1.25,
    "philosophy": 1.25,
    "society": 1.15,
    "travel": 1.0,
    "daily-life": 1.0,
    "nature": 0.95,
    "children": 0.8,
    "humor": 0.8,
    "war": 0.9,
    "work": 0.85,
    "general": 0.7,
}

WRITING_TYPE_MAP = {
    "新字新仮名": "modern Japanese orthography",
    "旧字旧仮名": "historical Japanese orthography",
    "新字旧仮名": "mixed orthography (new kanji, old kana)",
    "旧字新仮名": "mixed orthography (old kanji, new kana)",
    "その他": "other",
    "Unknown": "unknown",
    "": "unknown",
}


def download_dataset() -> None:
    if RAW_FILE.exists():
        print(f"Using existing file: {RAW_FILE}")
        return

    print("Downloading dataset...")
    urlretrieve(DATA_URL, RAW_FILE)
    print("Download complete.")


def load_full_corpus_stats() -> dict:
    if not FULL_CORPUS_FILE.exists():
        raise FileNotFoundError(
            f"{FULL_CORPUS_FILE} not found. Generate full_text_corpus.json first."
        )

    with open(FULL_CORPUS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\u3000]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def split_into_paragraphs(text: str) -> list[str]:
    parts = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    if parts:
        return parts
    return [p.strip() for p in text.split("\n") if p.strip()]


def split_sentences(text: str) -> list[str]:
    return [s.strip() for s in re.split(r"(?<=[。！？])", text) if s.strip()]


def build_passages(paragraphs: list[str]) -> list[str]:
    passages: list[str] = []
    current = ""

    def flush() -> None:
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


def is_good_passage(text: str) -> bool:
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
    return max(3, min(12, math.ceil(len(text) / 350)))


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

    if char_count > 950:
        score += 2
    elif char_count > 600:
        score += 1

    if kanji_ratio > 0.28:
        score += 3
    elif kanji_ratio > 0.22:
        score += 2
    elif kanji_ratio > 0.16:
        score += 1

    if avg_sentence_len > 55:
        score += 2
    elif avg_sentence_len > 35:
        score += 1

    if score <= 2:
        return "easy"
    if score <= 5:
        return "normal"
    return "hard"


def extract_title(meta: dict) -> str:
    for key in ["作品名", "title", "タイトル", "作品", "name"]:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Untitled"


def extract_author(meta: dict) -> str:
    sei = (meta.get("姓") or "").strip()
    mei = (meta.get("名") or "").strip()
    if sei or mei:
        return f"{sei}{mei}".strip()

    for key in ["姓名", "著者名", "著者", "作者名", "作家名", "人物", "name", "author"]:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    return "Unknown"


def extract_author_romaji(meta: dict) -> str:
    sei_romaji = (meta.get("姓ローマ字") or "").strip()
    mei_romaji = (meta.get("名ローマ字") or "").strip()
    if sei_romaji or mei_romaji:
        return f"{sei_romaji} {mei_romaji}".strip()
    return ""


def extract_writing_type(meta: dict) -> str:
    raw = (meta.get("文字遣い種別") or "Unknown").strip()
    return WRITING_TYPE_MAP.get(raw, raw)


def extract_publication_year(meta: dict) -> int | None:
    for key in ["底本初版発行年1", "底本初版発行年2", "初版発行年", "発行年", "出版年"]:
        value = meta.get(key)
        if isinstance(value, str) and value.strip():
            match = re.search(r"\b(18|19|20)\d{2}\b", value)
            if match:
                return int(match.group(0))
    return None


def extract_decade(year: int | None) -> int | None:
    if year is None:
        return None
    return (year // 10) * 10


def infer_theme(title: str, text: str, author: str = "") -> str:
    sample = f"{title}\n{text[:1400]}\n{author}"

    theme_rules = {
        "history": ["歴史", "戦", "幕府", "武士", "明治", "時代", "城", "将軍", "維新", "皇", "古代"],
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
    return best_theme if scores[best_theme] > 0 else "general"


def is_favorite_japanese_author(author: str) -> bool:
    return author in FAVORITE_JAPANESE_AUTHORS


def is_favorite_french_or_euro_author(author: str) -> bool:
    return author in FAVORITE_FRENCH_OR_EURO_AUTHORS


def is_allowed_writing_type(writing_type: str, author: str) -> bool:
    if writing_type == "modern Japanese orthography":
        return True

    if writing_type == "mixed orthography (new kanji, old kana)":
        return ALLOW_MIXED_NEW_KANJI_OLD_KANA

    if writing_type in {"historical Japanese orthography", "mixed orthography (old kanji, new kana)"}:
        if ALLOW_HISTORICAL_FOR_FAVORITES and (
            is_favorite_japanese_author(author) or is_favorite_french_or_euro_author(author)
        ):
            return True
        return False

    return False


def score_passage(
    *,
    author: str,
    writing_type: str,
    theme: str,
    publication_year: int | None,
    difficulty: str,
    text: str,
) -> float:
    score = 0.0

    if author == "夏目漱石":
        score += 10.0
    elif is_favorite_japanese_author(author):
        score += 6.0

    if is_favorite_french_or_euro_author(author):
        score += 5.0

    if writing_type == "modern Japanese orthography":
        score += 7.0
    elif writing_type == "mixed orthography (new kanji, old kana)":
        score += 1.5
    else:
        score -= 8.0

    score += PREFERRED_THEMES.get(theme, 0.7) * 3.0

    if publication_year is not None:
        if 1900 <= publication_year <= 1970:
            score += 2.0
        elif 1971 <= publication_year <= 2000:
            score += 1.2
        elif publication_year < 1900:
            score -= 1.0

    if difficulty == "normal":
        score += 3.0
    elif difficulty == "easy":
        score += 2.2
    elif difficulty == "hard":
        score += 1.2

    n = len(text)
    if 350 <= n <= 950:
        score += 1.5
    elif n > 1000:
        score -= 1.0

    kanji_ratio = count_kanji(text) / max(len(text), 1)
    if kanji_ratio > 0.30:
        score -= 2.5
    elif kanji_ratio > 0.24:
        score -= 1.5
    elif kanji_ratio < 0.10:
        score -= 0.4

    return score


def load_available_authors_from_stats(stats: dict) -> set[str]:
    return {item["author"] for item in stats.get("all_authors", [])}


def build_candidate_record(
    book_index: int,
    passage_index: int,
    title: str,
    author: str,
    author_romaji: str,
    writing_type: str,
    publication_year: int | None,
    passage: str,
) -> dict:
    theme = infer_theme(title, passage, author)
    difficulty = infer_difficulty(passage)
    decade = extract_decade(publication_year)

    score = score_passage(
        author=author,
        writing_type=writing_type,
        theme=theme,
        publication_year=publication_year,
        difficulty=difficulty,
        text=passage,
    )

    return {
        "id": f"curated-{book_index}-{passage_index}",
        "source": "aozora",
        "title": title,
        "author": author,
        "author_romaji": author_romaji,
        "writing_type": writing_type,
        "publication_year": publication_year,
        "decade": decade,
        "theme": theme,
        "difficulty": difficulty,
        "estimatedMinutes": estimate_minutes(passage),
        "score": round(score, 3),
        "text": passage,
        "questions": [],
    }


def select_diverse_corpus(candidates: list[dict]) -> list[dict]:
    selected: list[dict] = []

    author_counts = Counter()
    work_counts = Counter()
    theme_counts = Counter()
    decade_counts = Counter()
    difficulty_counts = Counter()

    candidates = sorted(candidates, key=lambda x: x["score"], reverse=True)

    for item in candidates:
        author = item["author"]
        title = item["title"]
        theme = item["theme"]
        decade = item["decade"]
        difficulty = item["difficulty"]

        if author_counts[author] >= MAX_PASSAGES_PER_AUTHOR:
            continue
        if work_counts[title] >= MAX_PASSAGES_PER_WORK:
            continue
        if theme_counts[theme] >= MAX_PASSAGES_PER_THEME:
            continue
        if decade is not None and decade_counts[decade] >= MAX_PASSAGES_PER_DECADE:
            continue
        if difficulty_counts[difficulty] >= MAX_PASSAGES_PER_DIFFICULTY[difficulty]:
            continue

        selected.append(item)
        author_counts[author] += 1
        work_counts[title] += 1
        theme_counts[theme] += 1
        difficulty_counts[difficulty] += 1
        if decade is not None:
            decade_counts[decade] += 1

        if len(selected) >= TARGET_PASSAGES:
            break

    return selected


def build_summary(selected: list[dict], available_authors: set[str]) -> dict:
    author_counts = Counter(item["author"] for item in selected)
    theme_counts = Counter(item["theme"] for item in selected)
    difficulty_counts = Counter(item["difficulty"] for item in selected)
    writing_type_counts = Counter(item["writing_type"] for item in selected)
    decade_counts = Counter(item["decade"] for item in selected if item["decade"] is not None)
    year_counts = Counter(item["publication_year"] for item in selected if item["publication_year"] is not None)

    favorite_author_presence = []
    for author in sorted(FAVORITE_JAPANESE_AUTHORS | FAVORITE_FRENCH_OR_EURO_AUTHORS):
        favorite_author_presence.append(
            {
                "author": author,
                "present_in_full_corpus": author in available_authors,
                "selected_passage_count": author_counts.get(author, 0),
            }
        )

    top_authors = []
    for author, count in author_counts.most_common(50):
        romaji = next(
            (
                item["author_romaji"]
                for item in selected
                if item["author"] == author and item["author_romaji"]
            ),
            "",
        )
        top_authors.append(
            {
                "author": author,
                "author_romaji": romaji,
                "count": count,
            }
        )

    return {
        "total_selected_passages": len(selected),
        "top_authors": top_authors,
        "theme_distribution": dict(theme_counts),
        "difficulty_distribution": dict(difficulty_counts),
        "writing_type_distribution": dict(writing_type_counts),
        "decade_distribution": dict(sorted(decade_counts.items())),
        "year_distribution_top_50": [
            {"year": year, "count": count}
            for year, count in year_counts.most_common(50)
        ],
        "favorite_author_presence": favorite_author_presence,
    }


def to_base36(value: int) -> str:
    digits = "0123456789abcdefghijklmnopqrstuvwxyz"
    if value == 0:
        return "0"

    parts: list[str] = []
    while value > 0:
        value, remainder = divmod(value, 36)
        parts.append(digits[remainder])
    return "".join(reversed(parts))


def build_frontend_passages(selected: list[dict]) -> list[dict]:
    frontend_passages: list[dict] = []
    for index, item in enumerate(selected):
        frontend_passages.append(
            {
                "id": to_base36(index),
                "title": item["title"],
                "author": item["author"],
                "difficulty": item["difficulty"],
                "text": item["text"],
            }
        )
    return frontend_passages


def main() -> None:
    download_dataset()
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    full_stats = load_full_corpus_stats()
    available_authors = load_available_authors_from_stats(full_stats)

    print("Favorite Japanese authors present in full corpus:")
    for author in sorted(FAVORITE_JAPANESE_AUTHORS):
        if author in available_authors:
            print(f"  OK  {author}")
        else:
            print(f"  --  {author}")

    print("\nFavorite French / European authors present in full corpus:")
    for author in sorted(FAVORITE_FRENCH_OR_EURO_AUTHORS):
        if author in available_authors:
            print(f"  OK  {author}")
        else:
            print(f"  --  {author}")

    candidates: list[dict] = []

    with gzip.open(RAW_FILE, "rt", encoding="utf-8") as file:
        for book_index, line in enumerate(file):
            row = json.loads(line)
            meta = row.get("meta", {})

            title = extract_title(meta)
            author = extract_author(meta)
            author_romaji = extract_author_romaji(meta)
            writing_type = extract_writing_type(meta)
            publication_year = extract_publication_year(meta)

            if not is_allowed_writing_type(writing_type, author):
                continue

            text = normalize_text(row.get("text", ""))
            if not text:
                continue

            paragraphs = split_into_paragraphs(text)
            passages = build_passages(paragraphs)

            for passage_index, passage in enumerate(passages):
                if not is_good_passage(passage):
                    continue

                candidate = build_candidate_record(
                    book_index=book_index,
                    passage_index=passage_index,
                    title=title,
                    author=author,
                    author_romaji=author_romaji,
                    writing_type=writing_type,
                    publication_year=publication_year,
                    passage=passage,
                )
                candidates.append(candidate)

    print(f"\nBuilt {len(candidates)} candidate passages before diversity selection.")

    curated = select_diverse_corpus(candidates)
    summary = build_summary(curated, available_authors)
    frontend_passages = build_frontend_passages(curated)

    with open(PASSAGES_FILE, "w", encoding="utf-8") as f:
        json.dump(frontend_passages, f, ensure_ascii=False, separators=(",", ":"))

    with open(CURATED_SUMMARY_FILE, "w", encoding="utf-8") as f:
        json.dump(summary, f, ensure_ascii=False, indent=2)

    print(f"\nDone. Wrote {len(frontend_passages)} lightweight passages to {PASSAGES_FILE}")
    print(f"Done. Wrote summary to {CURATED_SUMMARY_FILE}")

    print("\nTop authors:")
    for item in summary["top_authors"][:15]:
        label = f"{item['author']} ({item['author_romaji']})" if item["author_romaji"] else item["author"]
        print(f"  {label}: {item['count']}")

    print("\nTheme distribution:")
    for theme, count in sorted(summary["theme_distribution"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {theme}: {count}")

    print("\nDifficulty distribution:")
    for difficulty, count in sorted(summary["difficulty_distribution"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {difficulty}: {count}")

    print("\nWriting type distribution:")
    for writing_type, count in sorted(summary["writing_type_distribution"].items(), key=lambda x: x[1], reverse=True):
        print(f"  {writing_type}: {count}")


if __name__ == "__main__":
    main()