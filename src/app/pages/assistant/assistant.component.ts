import {
  Component,
  OnInit,
  OnDestroy,
  Inject,
  PLATFORM_ID,
  ElementRef,
  ViewChild
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { OptimizedImageComponent } from '../../components/optimized-image/optimized-image.component';
import {
  AssistantService,
  ChatMessage,
  AssistantAppResult,
  AssistantQuestion,
} from '../../services/assistant.service';

type AssistantState = 'idle' | 'loading' | 'results' | 'error';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    OptimizedImageComponent,
  ],
  templateUrl: './assistant.component.html',
  styleUrls: ['./assistant.component.scss'],
})
export class AssistantComponent implements OnInit, OnDestroy {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef<HTMLDivElement>;
  @ViewChild('inputField') inputField!: ElementRef<HTMLInputElement>;

  state: AssistantState = 'idle';
  messages: ChatMessage[] = [];
  userInput = '';
  sessionId = '';
  currentLang: 'ar' | 'en' = 'ar';
  isRtl = true;
  suggestions: AssistantQuestion[] = [];

  private destroy$ = new Subject<void>();

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private assistantService: AssistantService,
    private translate: TranslateService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Get lang from route params
    const langParam = this.route.snapshot.paramMap.get('lang');
    this.currentLang = (langParam === 'en' ? 'en' : 'ar');
    this.isRtl = this.currentLang === 'ar';

    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.currentLang = event.lang as 'ar' | 'en';
        this.isRtl = this.currentLang === 'ar';
      });

    this.sessionId = this.assistantService.generateSessionId();
    this.loadSuggestions();

    setTimeout(() => this.focusInput(), 200);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  sendMessage(): void {
    const text = this.userInput.trim();
    if (!text || this.state === 'loading') return;

    this.messages.push({ role: 'user', text });
    this.userInput = '';

    this.messages.push({ role: 'assistant', isLoading: true });
    this.state = 'loading';
    this.scrollToBottom();

    const request = {
      answers: {
        query: [text],
        category: [],
        platform: [],
        features: [],
        riwayah: [],
        mushaf_type: [],
      },
      session_id: this.sessionId,
      lang: this.currentLang,
    };

    this.assistantService.recommend(request)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.removeLoadingMessage();

          if (response.results && response.results.length > 0) {
            this.messages.push({
              role: 'assistant',
              text: this.currentLang === 'ar' ? 'اليك التطبيقات' : 'Here are the apps for you',
              results: response.results,
            });
            this.state = 'results';
          } else {
            this.messages.push({
              role: 'assistant',
              text: this.currentLang === 'ar'
                ? 'لم أجد تطبيقات مطابقة. جرب سؤالاً مختلفاً.'
                : 'No apps matched. Try a different question.',
            });
            this.state = 'idle';
          }
          this.scrollToBottom();
        },
        error: () => {
          this.removeLoadingMessage();
          this.messages.push({
            role: 'assistant',
            isError: true,
            text: this.currentLang === 'ar'
              ? 'حدث خطأ ما. يرجى المحاولة مرة أخرى.'
              : 'Something went wrong. Please try again.',
          });
          this.state = 'error';
          this.scrollToBottom();
        },
      });
  }

  onAppClick(app: AssistantAppResult): void {
    this.assistantService.selectApp(this.sessionId, String(app.id));
    this.router.navigate(['/', this.currentLang, 'app', app.slug]);
  }

  retry(): void {
    const lastUserMsg = [...this.messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg?.text) {
      if (this.messages.length > 0 && this.messages[this.messages.length - 1].isError) {
        this.messages.pop();
      }
      this.userInput = lastUserMsg.text;
      this.sendMessage();
    }
  }

  startOver(): void {
    this.messages = [];
    this.state = 'idle';
    this.sessionId = this.assistantService.generateSessionId();
    this.focusInput();
  }

  useSuggestion(question: AssistantQuestion): void {
    const label = this.currentLang === 'ar' ? question.question_ar : question.question_en;
    this.userInput = label;
    this.sendMessage();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  getAppName(app: AssistantAppResult): string {
    return this.currentLang === 'ar' ? app.name_ar : app.name_en;
  }

  getAppDescription(app: AssistantAppResult): string {
    return this.currentLang === 'ar' ? app.short_description_ar : app.short_description_en;
  }

  trackByMessageIndex(index: number): number {
    return index;
  }

  trackByAppId(_index: number, app: AssistantAppResult): string | number {
    return app.id;
  }

  // ── Private helpers ──

  private loadSuggestions(): void {
    this.assistantService.getQuestions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => { this.suggestions = res.questions || []; },
        error: () => {}
      });
  }

  private removeLoadingMessage(): void {
    const idx = this.messages.findIndex(m => m.isLoading);
    if (idx !== -1) { this.messages.splice(idx, 1); }
  }

  private scrollToBottom(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => {
      const el = this.messagesContainer?.nativeElement;
      if (el) { el.scrollTop = el.scrollHeight; }
    }, 50);
  }

  private focusInput(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    setTimeout(() => { this.inputField?.nativeElement?.focus(); }, 0);
  }
}
