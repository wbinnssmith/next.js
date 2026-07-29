const REFRESH_BURST_MS = 100
const REFRESH_MAX_WAIT_MS = 1000

/**
 * Coalesces adjacent server component updates without delaying the first one.
 * Longer change streams still refresh periodically so the preview makes
 * progress while codegen or source-control operations are running.
 */
export class TurbopackServerComponentRefreshScheduler {
  #lastRefreshMs: number | null = null
  #pendingRefresh: ReturnType<typeof setTimeout> | null = null
  #pendingRefreshCallback: (() => void) | null = null
  #isBuildPending = false
  #hasBuildError = false

  schedule(refresh: () => void) {
    // A server component change is only announced for a successful compile, so
    // it is safe to resume even though its BUILT message arrives just after it.
    this.#isBuildPending = false
    this.#hasBuildError = false

    const now = Date.now()
    const timeSinceLastRefresh =
      this.#lastRefreshMs === null ? Infinity : now - this.#lastRefreshMs
    const isRefreshBurst =
      this.#pendingRefreshCallback !== null ||
      timeSinceLastRefresh < REFRESH_BURST_MS

    if (!isRefreshBurst) {
      this.#lastRefreshMs = now
      refresh()
      return
    }

    this.#clearPendingTimer()
    this.#pendingRefreshCallback = refresh

    const remainingMaxWait = REFRESH_MAX_WAIT_MS - timeSinceLastRefresh
    if (remainingMaxWait <= 0) {
      this.#runPendingRefresh(now)
      return
    }

    this.#pendingRefresh = setTimeout(
      () => {
        this.#pendingRefresh = null
        this.#runPendingRefresh(Date.now())
      },
      Math.min(REFRESH_BURST_MS, remainingMaxWait)
    )
  }

  onBuilding() {
    this.#isBuildPending = true
    this.#clearPendingTimer()
  }

  onBuildError() {
    this.#isBuildPending = true
    this.#hasBuildError = true
    this.#clearPendingTimer()
  }

  onBuildOk() {
    if (!this.#isBuildPending) return

    this.#isBuildPending = false
    const hadBuildError = this.#hasBuildError
    this.#hasBuildError = false

    if (this.#pendingRefreshCallback !== null) {
      this.#runPendingRefresh(Date.now())
    } else if (hadBuildError) {
      // The next server component update should refresh immediately.
      this.#lastRefreshMs = null
    }
  }

  #clearPendingTimer() {
    if (this.#pendingRefresh !== null) {
      clearTimeout(this.#pendingRefresh)
      this.#pendingRefresh = null
    }
  }

  #runPendingRefresh(now: number) {
    const refresh = this.#pendingRefreshCallback
    this.#pendingRefreshCallback = null
    if (refresh === null) return

    this.#lastRefreshMs = now
    refresh()
  }
}
