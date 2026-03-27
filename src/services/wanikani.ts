import {
  WaniKaniUser,
  WaniKaniAssignment,
  WaniKaniSubject,
  WaniKaniReview,
  WaniKaniData,
} from '../types';

const RAW_API_BASE = import.meta.env.VITE_WANIKANI_API_BASE ?? 'https://api.wanikani.com';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

type APIResponse<T> = { data: T; pages: { next_url: string | null } };
type AssignmentsResponse = APIResponse<WaniKaniAssignment[]>;
type ReviewsResponse = APIResponse<WaniKaniReview[]>;
type SubjectsResponse = { data: WaniKaniSubject[] };

export class WaniKaniService {
  private apiToken: string;

  constructor(apiToken: string) {
    this.apiToken = apiToken;
  }

  private async fetchFromAPI<T>(endpoint: string): Promise<T> {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${normalizedEndpoint}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${this.apiToken}`,
        'Wanikani-Revision': '20170710',
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 401) {
        throw new Error('Invalid WaniKani API token');
      }
      throw new Error(
        `WaniKani API error ${response.status} ${response.statusText} at ${url}. Response: ${errorBody}`
      );
    }

    const data = await response.json();
    return data as T;
  }

  async getUser(): Promise<WaniKaniUser> {
    const userResp = await this.fetchFromAPI<{ data: WaniKaniUser }>('/v2/user');
    return (userResp as any).data;
  }

  async getAllAssignments(): Promise<WaniKaniAssignment[]> {
    const allAssignments: WaniKaniAssignment[] = [];
    let nextUrl: string | null = '/v2/assignments';
    const params = new URLSearchParams();
    params.set('unlocked_dates[exists]', 'true');

    while (nextUrl) {
      const assignResp: AssignmentsResponse = await this.fetchFromAPI<AssignmentsResponse>(
        nextUrl.includes('?') ? nextUrl : `${nextUrl}?${params}`
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
        `/v2/subjects?ids=${idString}`
      );

      subjResp.data.forEach((subject) => {
        subjectMap.set(subject.id, subject);
      });
    }

    return subjectMap;
  }

  async getReviews(): Promise<WaniKaniReview[]> {
    const allReviews: WaniKaniReview[] = [];
    let nextUrl: string | null = '/v2/reviews';

    while (nextUrl) {
      const revResp: ReviewsResponse = await this.fetchFromAPI<ReviewsResponse>(nextUrl);

      allReviews.push(...revResp.data);
      nextUrl = revResp.pages.next_url || null;
    }

    return allReviews;
  }

  async fetchAllData(): Promise<WaniKaniData> {
    try {
      const user = await this.getUser();
      const assignments = await this.getAllAssignments();
      const reviews = await this.getReviews();

      const subjectIds = Array.from(
        new Set(assignments.map((a) => a.data.subject_id))
      );

      const subjects = await this.getSubjects(subjectIds);

      return {
        user,
        assignments,
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
