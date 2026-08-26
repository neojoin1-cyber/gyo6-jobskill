import { Component } from 'react'
import { reloadLatestApp } from './lazyChunk.js'

function isLazyChunkError(error) {
  const message = String(error?.message || '').toLowerCase()
  return /chunk|dynamically imported|importing a module|failed to fetch|loading css/i.test(message)
}

/**
 * 렌더링 중 발생한 예외나 lazy 청크 로드 실패를 잡아
 * 백지/먹통 대신 복구 화면(다시 시도 · 새로고침)을 보여준다.
 * - 최상위(main.jsx)에 1개: 앱 전체 크래시 방어
 * - 교재 등 lazy 로딩 지점에 개별 배치: 부분 실패 시 그 영역만 복구
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // 운영 원격 로깅은 추후. 우선 콘솔에 남겨 진단 가능하게.
    console.error('[ErrorBoundary]', this.props.label || '', error, info?.componentStack)
  }

  handleRetry = () => {
    if (isLazyChunkError(this.state.error)) {
      this.handleReload()
      return
    }
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  handleReload = () => {
    if (isLazyChunkError(this.state.error)) {
      reloadLatestApp()
      return
    }
    try { window.location.reload() } catch { /* noop */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const isChunk = isLazyChunkError(this.state.error)

    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <div className="empty-state">
          <span className="empty-state-icon">⚠️</span>
          <span className="empty-state-title">{this.props.title || '문제가 발생했어요'}</span>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: 4 }}>
            {isChunk
              ? '콘텐츠를 불러오지 못했습니다.\n네트워크 상태를 확인한 뒤 새로고침해 주세요.'
              : '화면을 표시하는 중 오류가 발생했습니다.\n다시 시도하거나 새로고침해 주세요.'}
          </p>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={this.handleRetry}>
              {isChunk ? '최신 버전 불러오기' : '다시 시도'}
            </button>
            <button className="btn btn-primary" onClick={this.handleReload}>새로고침</button>
          </div>
        </div>
      </div>
    )
  }
}
