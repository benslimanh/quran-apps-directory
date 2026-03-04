import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Types ──

export interface AssistantOption {
  value: string;
  label_en: string;
  label_ar: string;
}

export interface AssistantQuestion {
  id: string;
  question_en: string;
  question_ar: string;
  filter_key: string;
  type: string;
  options: AssistantOption[];
}

export interface AssistantQuestionsResponse {
  questions: AssistantQuestion[];
}

export interface MatchReason {
  type: string;
  value: string;
  label_en: string;
  label_ar: string;
}

export interface AssistantAppResult {
  id: string | number;
  name_en: string;
  name_ar: string;
  short_description_en: string;
  short_description_ar: string;
  application_icon: string;
  slug: string;
  avg_rating: string;
  relevance_score: number;
  match_reasons: MatchReason[];
}

export interface RecommendResponse {
  count: number;
  results: AssistantAppResult[];
  fallback_mode: boolean;
}

export interface RecommendRequest {
  answers: Record<string, string[]>;
  session_id: string;
  lang: string;
}

export interface SelectAppRequest {
  session_id: string;
  app_id: string;
}

// ── Chat message types ──

export type ChatMessageRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatMessageRole;
  text?: string;
  results?: AssistantAppResult[];
  isLoading?: boolean;
  isError?: boolean;
}

// ── Service ──

@Injectable({
  providedIn: 'root'
})
export class AssistantService {
  private readonly apiUrl = `${environment.apiUrl}/assistant`;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /** Generate a new session ID */
  generateSessionId(): string {
    if (isPlatformBrowser(this.platformId) && typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback UUID v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /** GET /api/assistant/questions/ */
  getQuestions(): Observable<AssistantQuestionsResponse> {
    return this.http.get<AssistantQuestionsResponse>(`${this.apiUrl}/questions/`);
  }

  /** POST /api/assistant/recommend/ */
  recommend(request: RecommendRequest): Observable<RecommendResponse> {
    return this.http.post<RecommendResponse>(`${this.apiUrl}/recommend/`, request);
  }

  /** POST /api/assistant/select-app/ (fire-and-forget analytics) */
  selectApp(sessionId: string, appId: string): void {
    const body: SelectAppRequest = { session_id: sessionId, app_id: String(appId) };
    this.http.post(`${this.apiUrl}/select-app/`, body).subscribe({
      error: () => {} // Silently ignore errors for analytics
    });
  }
}
