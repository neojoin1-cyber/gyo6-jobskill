-- 미션 화면에서도 학습관의 평가 주체를 정확히 구분한다.
update public.subjects
set description = '교육부·대한상공회의소 직업기초능력평가 체계 연계 교재'
where id = 'job-common';

update public.subjects
set description = '고용노동부·한국산업인력공단 NCS 직업기초능력 필기 교재'
where id = 'ncs-basic';
