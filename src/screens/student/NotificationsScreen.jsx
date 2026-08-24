import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Check,
  ChatCircleDots,
  CheckCircle,
  Megaphone,
  PaperPlaneTilt,
  Sparkle,
  Trophy,
} from '@phosphor-icons/react'
import { useAuth } from '../../App.jsx'
import { supabase } from '../../lib/supabase.js'
import { formatDateTime } from '../../lib/dateUtils.js'
import '../../styles/campus.css'

const TYPE_META = {
  mission: { label: '미션', icon: CheckCircle, tone: 'blue' },
  result: { label: '결과', icon: Trophy, tone: 'yellow' },
  notice: { label: '공지', icon: Megaphone, tone: 'blue' },
  encourage: { label: '응원', icon: Sparkle, tone: 'mint' },
  streak: { label: '기록', icon: Trophy, tone: 'coral' },
  reply: { label: '답장', icon: ChatCircleDots, tone: 'mint' },
}

const QUICK_REPLIES = ['네, 확인했어요!', '조금 더 해볼게요', '도움이 필요해요']

export default function NotificationsScreen({ demo = false }) {
  const { profile } = useAuth() ?? {}
  const [items, setItems] = useState(demo ? demoItems() : [])
  const [loading, setLoading] = useState(!demo)
  const [filter, setFilter] = useState('all')
  const [replyTo, setReplyTo] = useState(null)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [replySent, setReplySent] = useState({})

  useEffect(() => {
    if (demo || !profile) return
    load()
    const channel = supabase.channel(`notifications-${profile.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${profile.id}`,
      }, payload => setItems(previous => [payload.new, ...previous]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [demo, profile?.id])

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data ?? [])
    setLoading(false)
  }

  async function markAll() {
    if (!demo) await supabase.rpc('rpc_mark_all_notifications_read')
    setItems(previous => previous.map(item => ({ ...item, is_read: true })))
  }

  async function markOne(id) {
    if (!demo) await supabase.rpc('rpc_mark_notification_read', { p_notification_id: id })
    setItems(previous => previous.map(item => item.id === id ? { ...item, is_read: true } : item))
  }

  async function sendReply(id) {
    const text = replyBody.trim()
    if (!text) return
    setSending(true)
    const response = demo
      ? { data: { ok: true }, error: null }
      : await supabase.rpc('rpc_reply_message', { p_notification_id: id, p_body: text })
    setSending(false)
    if (response.error || response.data?.error) return
    setReplySent(previous => ({ ...previous, [id]: text }))
    setReplyTo(null)
    setReplyBody('')
  }

  const unreadCount = items.filter(item => !item.is_read).length
  const visible = useMemo(() => items.filter(item => {
    if (filter === 'teacher') return Boolean(item.sender_id)
    if (filter === 'learning') return !item.sender_id
    return true
  }), [items, filter])

  if (!demo && !profile) return null
  if (loading) return <div className="campus-loading"><span /></div>

  return (
    <main className="message-home">
      <header className="message-header">
        <div>
          <span className="message-kicker">CAMPUS POST</span>
          <h1>소식</h1>
          <p>선생님 메시지와 학습 소식을 한곳에서 확인해요.</p>
        </div>
        <span className="message-header-mark"><PaperPlaneTilt weight="fill" /></span>
      </header>

      <div className="message-toolbar">
        <div className="message-filters" role="tablist" aria-label="소식 필터">
          {[['all', '전체'], ['teacher', '선생님'], ['learning', '학습']].map(([id, label]) => (
            <button key={id} className={filter === id ? 'is-on' : ''} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
        {unreadCount > 0 && <button className="message-read-all" onClick={markAll}><Check /> 모두 읽음</button>}
      </div>

      <section className="message-feed" aria-live="polite">
        {visible.length === 0 ? (
          <div className="message-empty">
            <Bell />
            <b>새 소식이 아직 없어요</b>
            <span>캠퍼스를 탐험하면 여기에 기록이 모여요.</span>
          </div>
        ) : visible.map(item => {
          const meta = TYPE_META[item.type] ?? TYPE_META.notice
          const Icon = item.sender_id ? ChatCircleDots : meta.icon
          const canReply = Boolean(item.sender_id) && item.type !== 'reply'
          return (
            <article key={item.id} className={`message-item ${item.sender_id ? 'is-teacher' : ''} ${item.is_read ? '' : 'is-unread'}`}
              onClick={() => !item.is_read && markOne(item.id)}>
              <span className={`message-type is-${meta.tone}`}><Icon weight="fill" /></span>
              <div className="message-content">
                <div className="message-meta">
                  <b>{item.sender_id ? '담당 선생님' : meta.label}</b>
                  {!item.is_read && <i>새 소식</i>}
                  <time>{formatDateTime(item.created_at)}</time>
                </div>
                <h2>{item.title}</h2>
                {item.body && <p>{item.body}</p>}

                {replySent[item.id] && (
                  <div className="message-my-reply"><Check weight="bold" /> 내가 보낸 답장: {replySent[item.id]}</div>
                )}

                {canReply && !replySent[item.id] && replyTo !== item.id && (
                  <button className="message-reply-open" onClick={event => { event.stopPropagation(); setReplyTo(item.id); setReplyBody('') }}>
                    <PaperPlaneTilt /> 답장하기
                  </button>
                )}

                {replyTo === item.id && (
                  <div className="message-composer" onClick={event => event.stopPropagation()}>
                    <div className="quick-replies">
                      {QUICK_REPLIES.map(text => <button key={text} onClick={() => setReplyBody(text)}>{text}</button>)}
                    </div>
                    <textarea rows={3} maxLength={300} value={replyBody} autoFocus
                      placeholder="선생님께 전할 말을 적어 보세요"
                      onChange={event => setReplyBody(event.target.value)} />
                    <div>
                      <span>{replyBody.length} / 300</span>
                      <button className="composer-cancel" onClick={() => { setReplyTo(null); setReplyBody('') }}>취소</button>
                      <button className="composer-send" disabled={sending || !replyBody.trim()} onClick={() => sendReply(item.id)}>
                        <PaperPlaneTilt weight="fill" /> {sending ? '보내는 중' : '보내기'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </article>
          )
        })}
      </section>
    </main>
  )
}

function demoItems() {
  return [
    { id: 'm1', sender_id: 'teacher', type: 'encourage', title: '김선생님', body: '지난 대화 과제에서 질문 방식이 정말 좋아졌어! 다음 챕터도 기대할게 :)', is_read: false, created_at: new Date().toISOString() },
    { id: 'm2', sender_id: null, type: 'mission', title: '새 캠퍼스 미션이 열렸어요', body: '오늘의 미션에서 선생님이 준비한 12분 활동을 시작해 보세요.', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
    { id: 'm3', sender_id: null, type: 'result', title: '표현력 스탬프를 받았어요', body: '상황별 표현 · 여행에서 8문장을 완성했어요.', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
  ]
}
