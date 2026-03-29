import {
  WaniKaniUser,
  WaniKaniAssignment,
  WaniKaniSubject,
  WaniKaniReview,
  WaniKaniData,
} from '../types';

// Follow WaniKani's recommended pattern: https://api.wanikani.com/v2/<endpoint>
const RAW_API_BASE = import.meta.env.VITE_WANIKANI_API_BASE ?? 'https://api.wanikani.com/v2';
const NORMALIZED_BASE = RAW_API_BASE.replace(/\/+$/, '');
const API_BASE = /\/v2$/.test(NORMALIZED_BASE) ? NORMALIZED_BASE : `${NORMALIZED_BASE}/v2`;

type APIResponse<T> = { data: T; pages: { next_url: string | null } };
type AssignmentsResponse = APIResponse<WaniKaniAssignment[]>;
type ReviewsResponse = APIResponse<WaniKaniReview[]>;
type SubjectsResponse = APIResponse<WaniKaniSubject[]>;

function normalizeSubject(subject: WaniKaniSubject): WaniKaniSubject {
  const subjectType = subject.type ?? subject.object;
  return {
    ...subject,
    type: subjectType,
  };
}

export class WaniKaniService {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async fetchFromAPI<T>(endpoint: string): Promise<T> {
    // Allow absolute URLs (WaniKani next_url provides full URLs) or relative endpoints.
    if (!endpoint) {
      throw new Error('WaniKani API endpoint is required');
    }

    const trimmed = endpoint.trim();

    // Absolute URLs (e.g., next_url) pass through untouched.
    const url = trimmed.startsWith('http')
      ? trimmed
      : `${API_BASE}/${trimmed.replace(/^\/+/, '')}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Wanikani-Revision': '20170710',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();

      if (response.status === 401) {
        throw new Error('Invalid or expired WaniKani API token (401).');
      }

      if (response.status === 404) {
        throw new Error(
          `WaniKani API endpoint not found (404): ${url}. Check that the path exists, e.g., "/user", "/assignments", "/reviews". Response: ${errorBody}`
        );
      }

      throw new Error(
        `WaniKani API error ${response.status} ${response.statusText} at ${url}. Response: ${errorBody}`
      );
    }

    const data = await response.json();
    return data as T;
  }

  async getUser(): Promise<WaniKaniUser> {
    const userResp = await this.fetchFromAPI<{ data: WaniKaniUser }>('/user');
    return (userResp as any).data;
  }

  async getAllAssignments(): Promise<WaniKaniAssignment[]> {
    const allAssignments: WaniKaniAssignment[] = [];
    let nextUrl: string | null = '/assignments';

    while (nextUrl) {
      const assignResp: AssignmentsResponse = await this.fetchFromAPI<AssignmentsResponse>(
        nextUrl
      );

      allAssignments.push(...assignResp.data);
      nextUrl = assignResp.pages.next_url || null;
    }

    return allAssignments;
  }

  async getSubjects(ids: number[]): Promise<Map<number, WaniKaniSubject>> {
    const subjectMap = new Map<number, WaniKaniSubject>();

    const batchSize = 100;
    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const idString = batch.join(',');

      const subjResp: SubjectsResponse = await this.fetchFromAPI<SubjectsResponse>(
        `/subjects?ids=${idString}`
      );

      subjResp.data.forEach((subject) => {
        const normalizedSubject = normalizeSubject(subject);
        subjectMap.set(normalizedSubject.id, normalizedSubject);
      });
    }

    return subjectMap;
  }

  async getAllSubjectsByType(
    subjectType: 'kanji' | 'vocabulary' | 'kana_vocabulary'
  ): Promise<WaniKaniSubject[]> {
    const allSubjects: WaniKaniSubject[] = [];
    let nextUrl: string | null = `/subjects?types=${subjectType}`;

    while (nextUrl) {
      const subjResp: SubjectsResponse = await this.fetchFromAPI<SubjectsResponse>(nextUrl);
      allSubjects.push(...subjResp.data.map(normalizeSubject));
      nextUrl = subjResp.pages.next_url || null;
    }

    return allSubjects;
  }

  async getReviews(): Promise<WaniKaniReview[]> {
    const allReviews: WaniKaniReview[] = [];
    let nextUrl: string | null = '/reviews';

    while (nextUrl) {
      const revResp: ReviewsResponse = await this.fetchFromAPI<ReviewsResponse>(nextUrl);

      allReviews.push(...revResp.data);
      nextUrl = revResp.pages.next_url || null;
    }

    return allReviews;
  }

  async fetchAllData(): Promise<WaniKaniData> {
    try {
      const [user, assignments, reviews, kanjiSubjects, vocabularySubjects, kanaVocabularySubjects] =
        await Promise.all([
          this.getUser(),
          this.getAllAssignments(),
          this.getReviews(),
          this.getAllSubjectsByType('kanji'),
          this.getAllSubjectsByType('vocabulary'),
          this.getAllSubjectsByType('kana_vocabulary'),
        ]);

      const subjectIds = Array.from(
        new Set(assignments.map((a) => a.data.subject_id))
      );

      const assignmentSubjects = await this.getSubjects(subjectIds);
      const subjects = new Map<number, WaniKaniSubject>();

      assignmentSubjects.forEach((subject) => {
        subjects.set(subject.id, subject);
      });
      kanjiSubjects.forEach((subject) => {
        subjects.set(subject.id, subject);
      });
      vocabularySubjects.forEach((subject) => {
        subjects.set(subject.id, subject);
      });
      kanaVocabularySubjects.forEach((subject) => {
        subjects.set(subject.id, subject);
      });

      const subjectTypeCounts = {
        radical: 0,
        kanji: 0,
        vocabulary: 0,
        kana_vocabulary: 0,
      };

      subjects.forEach((subject) => {
        switch (subject.type) {
          case 'radical':
          case 'kanji':
          case 'vocabulary':
          case 'kana_vocabulary':
            subjectTypeCounts[subject.type] += 1;
            break;
          default:
            break;
        }
      });

      console.log('[WaniKani] fetch summary', {
        user: user.username,
        level: user.level,
        assignments: assignments.length,
        reviews: reviews.length,
        subjects: subjects.size,
        subjectTypes: subjectTypeCounts,
      });
      console.log('[WaniKani] sample assignments', assignments.slice(100, 105));
      console.log('[WaniKani] sample reviews', reviews.slice(0, 5));
      console.log('[WaniKani] sample kanji', kanjiSubjects.slice(0, 5));
      console.log('[WaniKani] sample vocabulary', vocabularySubjects.slice(0, 5));
      console.log('[WaniKani] sample kana_vocabulary', kanaVocabularySubjects.slice(0, 5));

      return {
        user,
        assignments,
        kanjiSubjects,
        vocabularySubjects,
        kanaVocabularySubjects,
        subjects,
        reviews,
        fetchedAt: Date.now(),
      };
    } catch (error) {
      throw error;
    }
  }
}

export async function testWaniKaniConnection(apiToken: string): Promise<boolean> {
  try {
    const service = new WaniKaniService(apiToken);
    await service.getUser();
    return true;
  } catch {
    return false;
  }
}
