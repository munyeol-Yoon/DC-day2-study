import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AccessLogRepository } from '../auth/repositories';
import { Request } from 'express';
import { User } from '../auth/entities';

// DI 관리를 위한 데코레이터 추가
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // NestJS 로거 인스턴스 생성
  private readonly logger = new Logger(LoggingInterceptor.name);
  // 생성자 주입
  constructor(private readonly accessLogRepository: AccessLogRepository) {}

  // intercept 메서드
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    // HTTP 요청 객체를 가져옴
    const request: Request = context.switchToHttp().getRequest();
    const { ip, method, originalUrl } = request;
    const userAgent = request.headers['user-agent'] || '';
    const user = request.user as User; // AuthGuard 가 이 값을 설정할 것

    // next.handle() -> 요청 처리 파이프라인 진행
    // pipe() 와 RxJS 연산자를 사용해 요청 처리 후 로직 추가
    return next.handle().pipe(
      // tap() -> 요청 처리가 성공적으로 완료된 후 실행될 로직 정의
      tap(async () => {
        try {
          if (
            // ELB-HealthChecker 나 로그인 요청이 아닐때 로그 실행
            !userAgent.includes('ELB-HealthChecker') &&
            originalUrl !== '/auth/login'
          ) {
            // 로그 DB 저장
            await this.accessLogRepository.createAccessLog(
              user,
              userAgent,
              `${method} ${originalUrl}`,
              ip,
            );
          }
        } catch (err) {
          // 로그 생성중 오류 발생시 로그를 남김
          this.logger.error('Failed to create access log');
        }
      }),
      catchError((err) => {
        // 요청 처리중 발생한 오류일시 로그를 남김
        this.logger.error(`Error in request: ${err}`);
        return throwError(err);
      }),
    );
  }
}
