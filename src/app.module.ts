import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validationSchema } from './config/validation.schema';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { addTransactionalDataSource } from 'typeorm-transactional';
import { DataSource } from 'typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggingInterceptor } from './interceptors';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env`,
      validationSchema,
    }),
    // TypeOrmModule 참고 링크 : https://docs.nestjs.com/techniques/database
    // forRootAsync 를 통해 비동기 설정
    TypeOrmModule.forRootAsync({
      // 환경변수 사용
      imports: [ConfigModule],
      // inject 해 환경변수에 접근 가능
      inject: [ConfigService],
      // useFactory 는 비동기적 접근 방법중 하나, 설정 객체를 동적으로 생성하는 팩토리함수
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_DATABASE'),
        autoLoadEntities: true, // 엔티티 자동 로드, 이거 안쓰면 [] 하고 하나씩 추가해야함
        synchronize: configService.get<string>('RUNTIME') !== 'prod',
        logging: configService.get<string>('RUNTIME') !== 'prod',
      }),
      // 데이터 소스 생성
      async dataSourceFactory(options) {
        if (!options) {
          throw new Error('Invalid options passed');
        }
        // 트랜잭션 관리가 가능한 데이터 소스 생성 후 반환
        return addTransactionalDataSource(new DataSource(options));
      },
    }),
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
