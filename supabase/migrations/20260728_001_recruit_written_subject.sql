-- 채용기관별 추가 필기영역을 NCS 공식 교재와 분리한 독립 교재.
insert into subjects (id, name, data_file) values
  ('recruit-written', '채용 필기시험 실전확장', 'ncs-questions.json')
on conflict (id) do update set name = excluded.name;
