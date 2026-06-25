import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase.js'
import * as XLSX from 'xlsx'

const ROLE_MAP = {
  '학생': 'student',
  '교사': 'teacher',
  '학급관리자': 'class_admin',
  '학교관리자': 'school_admin',
}
const ROLE_LABEL = { student: '학생', teacher: '교사', class_admin: '학급관리자', school_admin: '학교관리자' }
const VALID_ROLES = ['student', 'teacher', 'class_admin', 'school_admin']

function parseRows(text, classes) {
  if (!text.trim()) return []
  const lines = text.trim().split('\n').filter(l => l.trim())
  if (!lines.length) return []

  const firstCell = lines[0].split('\t')[0].trim().replace(/^"|"$/g, '')
  const isHeader = /^(이름|name|display_name)/i.test(firstCell)
  const dataLines = isHeader ? lines.slice(1) : lines

  return dataLines.map((line, idx) => {
    const cols = line.split('\t').map(c => c.trim().replace(/^"|"$/g, ''))
    const [display_name = '', email = '', password = '', roleKo = '',
           department = '', grade = '', class_num = '', nickname = ''] = cols

    const role = ROLE_MAP[roleKo] ?? (VALID_ROLES.includes(roleKo) ? roleKo : '')

    const errors = []
    if (!display_name)                            errors.push('이름 필수')
    if (!email || !email.includes('@'))           errors.push('이메일 오류')
    if (!password || password.length < 6)         errors.push('비밀번호 6자↑')
    if (!role)                                    errors.push(`역할 오류(${roleKo || '비어있음'})`)

    let class_id = null
    if (role === 'student') {
      if (!department)  errors.push('학과 필수')
      else if (!grade)  errors.push('학년 필수')
      else if (!class_num) errors.push('학반 필수')
      else {
        const cls = classes.find(c =>
          c.department === department &&
          String(c.grade) === String(grade) &&
          String(c.class_num) === String(class_num)
        )
        if (cls) class_id = cls.id
        else errors.push(`${department} ${grade}-${class_num}반 없음`)
      }
    }

    return {
      idx: idx + 1, display_name, email, password,
      role, department, grade, class_num, nickname,
      class_id, errors,
      status: 'pending', resultError: null,
    }
  }).filter(r => r.display_name || r.email)
}

const TH = { padding: '5px 7px', textAlign: 'left', borderBottom: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }
const TD = { padding: '4px 7px', borderBottom: '1px solid var(--border)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11 }

export default function BulkRegisterModal({
  fixedSchoolId,   // school_admin: 자기 학교 ID (고정)
  schools,         // admin: 학교 목록
  onClose,
  onDone,
}) {
  const [schoolId, setSchoolId]     = useState(fixedSchoolId || '')
  const [allClasses, setAllClasses] = useState([])
  const [pasteText, setPasteText]   = useState('')
  const [rows, setRows]             = useState([])
  const [registering, setRegistering] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    if (!schoolId) { setAllClasses([]); return }
    supabase.from('classes').select('id, department, grade, class_num')
      .eq('school_id', schoolId)
      .order('department').order('grade').order('class_num')
      .then(({ data }) => setAllClasses(data ?? []))
  }, [schoolId])

  useEffect(() => {
    if (pasteText.trim()) setRows(parseRows(pasteText, allClasses))
  }, [allClasses])

  function downloadTemplate() {
    const wb  = XLSX.utils.book_new()
    const ws  = XLSX.utils.aoa_to_sheet([
      ['이름', '이메일', '비밀번호', '역할', '학과', '학년', '학반', '닉네임'],
      ['홍길동', 'hong@school.hs.kr', 'pass1234', '학생', '경영과', '1', '1', '홍길동짱'],
      ['이영희', 'lee@school.hs.kr',  'pass1234', '학생', '관광과', '2', '3', ''],
      ['김선생', 'kim@school.hs.kr',  'pass1234', '교사', '', '', '', ''],
    ])
    ws['!cols'] = [10, 26, 12, 10, 10, 6, 6, 14].map(wch => ({ wch }))
    XLSX.utils.book_append_sheet(wb, ws, '회원등록')
    XLSX.writeFile(wb, '회원등록양식.xlsx')
  }

  function applyText(text) {
    setPasteText(text)
    setRows(parseRows(text, allClasses))
  }

  function handleFile(e) {
    const file = e.target.files[0]; if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = evt => {
      const wb   = XLSX.read(evt.target.result, { type: 'binary' })
      const ws   = wb.Sheets[wb.SheetNames[0]]
      const tsv  = XLSX.utils.sheet_to_csv(ws, { FS: '\t' })
      applyText(tsv)
    }
    reader.readAsBinaryString(file)
  }

  async function register() {
    if (!schoolId) return
    const valid = rows.filter(r => r.errors.length === 0)
    if (!valid.length) return
    setRegistering(true)

    for (const row of valid) {
      const { error } = await supabase.rpc('rpc_admin_create_user', {
        p_email:        row.email,
        p_password:     row.password,
        p_display_name: row.display_name,
        p_role:         row.role,
        p_school_id:    schoolId,
        p_class_id:     row.class_id || null,
        p_nickname:     row.nickname || null,
      })
      const msg = error?.message
        ? (error.message.includes('duplicate') || error.message.includes('already exists')
            ? '이미 존재하는 이메일' : error.message.slice(0, 60))
        : null
      setRows(prev => prev.map(r =>
        r.idx === row.idx ? { ...r, status: error ? 'error' : 'done', resultError: msg } : r
      ))
    }
    setRegistering(false)
    onDone?.()
  }

  const validCount = rows.filter(r => r.errors.length === 0).length
  const doneCount  = rows.filter(r => r.status === 'done').length
  const errCount   = rows.filter(r => r.status === 'error').length
  const isAdmin    = !fixedSchoolId

  const rowBg = r => {
    if (r.status === 'done')  return '#e8f5e9'
    if (r.status === 'error') return '#ffebee'
    if (r.errors.length)      return '#fff3e0'
    return 'transparent'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1100 }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'var(--card-bg, #fff)', borderRadius: '16px 16px 0 0', maxHeight: '92vh', overflowY: 'auto', padding: 20 }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontWeight: 700, fontSize: 16 }}>📤 일괄 회원 등록</p>
          <button className="btn btn-ghost" style={{ padding: '4px 10px' }} onClick={onClose}>✕</button>
        </div>

        {/* 학교 선택 (admin만) */}
        {isAdmin && (
          <div className="form-group">
            <label className="form-label">학교 *</label>
            <select className="form-input" value={schoolId}
              onChange={e => { setSchoolId(e.target.value); setRows([]) }}>
              <option value="">학교 선택</option>
              {(schools ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {/* 양식 안내 */}
        <div style={{ background: 'var(--primary-light, #eff6ff)', border: '1px solid var(--primary)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <p style={{ fontSize: 12, lineHeight: 1.7 }}>
            <strong>열 순서:</strong> 이름 · 이메일 · 비밀번호 · 역할 · 학과 · 학년 · 학반 · 닉네임<br />
            <strong>역할 값:</strong> 학생 / 교사 / 학급관리자<br />
            엑셀 양식을 다운로드하거나, 엑셀 셀을 복사(Ctrl+C)해서 아래에 붙여넣기(Ctrl+V)하세요.
          </p>
        </div>

        {/* 도구 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={downloadTemplate}>
            ⬇ 엑셀 양식
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 13 }}
            onClick={() => fileRef.current?.click()}>
            📁 파일 업로드
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={handleFile} />
          {rows.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12, marginLeft: 'auto', color: 'var(--text-muted)' }}
              onClick={() => { setPasteText(''); setRows([]) }}>
              초기화
            </button>
          )}
        </div>

        {/* 붙여넣기 영역 */}
        <textarea
          className="form-input"
          style={{ minHeight: 90, fontFamily: 'monospace', fontSize: 11, resize: 'vertical' }}
          placeholder={'엑셀에서 데이터 행 선택 → Ctrl+C → 여기서 Ctrl+V\n(헤더행 포함해도 됩니다)'}
          value={pasteText}
          onChange={e => applyText(e.target.value)}
          disabled={!schoolId && isAdmin}
        />
        {!schoolId && isAdmin && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>학교를 먼저 선택하세요.</p>
        )}

        {/* 미리보기 테이블 */}
        {rows.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
              미리보기 — 총 {rows.length}행
              {validCount > 0 && <span style={{ color: 'var(--success, #16a34a)', marginLeft: 8 }}>유효 {validCount}명</span>}
              {rows.filter(r => r.errors.length).length > 0 && (
                <span style={{ color: 'var(--warning, #d97706)', marginLeft: 8 }}>
                  오류 {rows.filter(r => r.errors.length).length}행
                </span>
              )}
            </p>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ background: 'var(--border)' }}>
                    <th style={TH}>#</th>
                    <th style={TH}>이름</th>
                    <th style={TH}>이메일</th>
                    <th style={TH}>역할</th>
                    <th style={TH}>학반</th>
                    <th style={{ ...TH, minWidth: 120 }}>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ background: rowBg(r) }}>
                      <td style={TD}>{r.idx}</td>
                      <td style={TD}>{r.display_name || '—'}</td>
                      <td style={{ ...TD, maxWidth: 150 }}>{r.email || '—'}</td>
                      <td style={TD}>{ROLE_LABEL[r.role] || r.role || '—'}</td>
                      <td style={TD}>
                        {r.role === 'student'
                          ? `${r.department} ${r.grade}-${r.class_num}반`
                          : '—'}
                      </td>
                      <td style={{ ...TD, maxWidth: 160 }}>
                        {r.status === 'done'  ? '✅ 등록완료' :
                         r.status === 'error' ? `❌ ${r.resultError || '오류'}` :
                         r.errors.length      ? `⚠️ ${r.errors.join(' · ')}` :
                         '✓ 유효'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 진행 요약 */}
        {(doneCount > 0 || errCount > 0) && (
          <p style={{ marginTop: 10, fontSize: 13 }}>
            {doneCount > 0 && <span style={{ color: 'var(--success, #16a34a)' }}>✅ {doneCount}명 등록완료</span>}
            {errCount  > 0 && <span style={{ color: 'var(--danger)', marginLeft: 10 }}>❌ {errCount}명 오류</span>}
          </p>
        )}

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingBottom: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose} disabled={registering}>닫기</button>
          <button className="btn btn-primary" style={{ flex: 1 }}
            disabled={!schoolId || validCount === 0 || registering}
            onClick={register}>
            {registering
              ? `등록 중… ${doneCount + errCount}/${validCount}`
              : `${validCount}명 일괄 등록`}
          </button>
        </div>
      </div>
    </div>
  )
}
