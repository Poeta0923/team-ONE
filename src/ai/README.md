<!-- GET	/train/health	학습 서버 상태 및 버전 확인
	/train/system/resources	CPU/메모리/디스크 사용량 조회
	/train/datasets	등록된 데이터셋 목록 조회
	/train/datasets/{datasetId}	특정 데이터셋 상세 정보 조회
	/train/experiments	등록된 실험 목록 조회
	/train/experiments/{experimentId}	특정 실험 상세 조회
	train/jobs	학습/평가/재학습 Job(작업) 목록 조회
	/train/jobs/{jobId}	특정 Job 상태/로그/산출물 조회
	/train/models	등록된 모델 목록 조회
	/train/models/{modelId}	특정 모델 상세 정보 조회
	/train/reports/{reportId}	평가/성능 검증 리포트 조회
POST	/train/ingest	데이터 수집 및 적재
	/train/datasets	전처리 규칙을 적용한 학습용 데이터셋 생성
	/train/features/embeddings	사용자/프로젝트 임베딩 생성 Job 실행
	/train/features/skills	사용자 스킬 추출 Job 실행
	/train/experiments	새로운 실험 메타데이터 생성
	/train/train	모델 학습 Job 실행
	/train/retrain	기존 모델 기반 재학습 Job 실행
	/train/cv	교차검증 Job 실행
	/train/evaluate	모델 평가 및 편향 검증 Job 실행
	/train/models/register	학습 완료 모델을 레지스트리에 등록
	/train/deploy	모델 서빙 서버에 배포
	/train/inference/sandbox	샌드박스 환경에서 추론 실행
	/train/jobs/{jobId}/cancel	특정 Job 실행 취소
PATCH	/train/models/{modelId}	모델 메타 정보 수정
	/train/experiments/{experimentId}	실험 메타데이터 수정
	/train/ai-model/parameters	학습/추론 AI 모델 파라미터 수정
DELETE	/train/datasets/{datasetId}	특정 데이터셋 삭제
	/train/models/{modelId}	특정 모델 삭제
	/train/experiments/{experimentId}	특정 실험 삭제 -->

<!-- 
#traits_fastapi 
- sudo mkdir -p /mnt/e/tools
- sudo chmod 777 /mnt/e/tools
- wget -O /mnt/e/tools/jq https://github.com/jqlang/jq/releases/latest/download/jq-linux64
- chmod +x /mnt/e/tools/jq
- export PATH="/mnt/e/tools:$PATH"
- jq --version
- curl -s http://localhost:8091/train/health | jq
- curl --fail -sS -X POST http://localhost:8091/train/train   -H "Content-Type: application/json"   --data-binary @"파일위치/train_payload.json" | jq
- JOB_ID="위에나온 ID"
-  while true; do   curl -s "http://localhost:8091/train/jobs/$JOB_ID" | tee /tmp/traits_job.json;   STATUS=$(jq -r '.status' /tmp/traits_job.json);   [[ "$STATUS" == "DONE" || "$STATUS" == "ERROR" ]] && break;   sleep 2; done
- q . /tmp/traits_job.json
- curl -s http://localhost:8091/train/models | jq
- curl -s -X POST http://localhost:8091/score   -H "Content-Type: application/json"   --data-binary @- <<'JSON' | jq{ "text": "작업 일정을 사전에 계획하고 팀원들의 협업을 조율합니다." }
JSON

#평가 F1 micro/macro, 라벨별 ROC-AUC / 리더십/신뢰성 성향
jq '( .data // [] )
  | [ .[] 
      | ( to_entries
          | sort_by(.value) | reverse | .[:2]
          | map({label:.key, prob:.value}) ) ]' /tmp/sandbox_resp.json
 -->

<!-- // 배치 스코어, TOP-N 정렬
curl -sS -X POST http://127.0.0.1:8093/score/batch \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/batch_min.json \
| jq -r '
  (.data // [])
  | to_entries
  | sort_by(.value.prob) | reverse
  | .[]
  | [ ("idx:" + (.key|tostring)),
      .value.prob,
      .value.weighted_score,
      .value.facet_scores.skill,
      .value.facet_scores.trait,
      .value.facet_scores.activity
    ] | @tsv
'
 -->

<!-- 후보생성 모델 정확도
curl -s http://localhost:8091/train/evaluate_candidate_demo   -H "Content-Type: application/json"   -d '{"n_candidates":100,"n_queries":500,"k":4,"metric":"cosine","bins":30,"seed":42}' | jq . -->

<!-- 수락확률 정확도
curl -s http://localhost:8091/train/evaluate \
  -H "Content-Type: application/json" \
  --data-binary "@accept_train.json" | jq -->