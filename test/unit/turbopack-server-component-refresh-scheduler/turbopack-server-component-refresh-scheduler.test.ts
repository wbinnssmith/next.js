/* eslint-env jest */
import { TurbopackServerComponentRefreshScheduler } from '../../../packages/next/src/client/dev/hot-reloader/turbopack-server-component-refresh-scheduler'

describe('TurbopackServerComponentRefreshScheduler', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(10_000)
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('refreshes on the leading edge and once after a burst', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const refresh = jest.fn()

    scheduler.schedule(refresh)
    expect(refresh).toHaveBeenCalledTimes(1)

    for (let index = 0; index < 8; index++) {
      jest.advanceTimersByTime(50)
      scheduler.schedule(refresh)
    }

    expect(refresh).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(99)
    expect(refresh).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('uses the latest callback for the trailing refresh', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const leadingRefresh = jest.fn()
    const staleRefresh = jest.fn()
    const latestRefresh = jest.fn()

    scheduler.schedule(leadingRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(staleRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(latestRefresh)
    jest.advanceTimersByTime(100)

    expect(leadingRefresh).toHaveBeenCalledTimes(1)
    expect(staleRefresh).not.toHaveBeenCalled()
    expect(latestRefresh).toHaveBeenCalledTimes(1)
  })

  it('refreshes at the max wait during sustained changes', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const refresh = jest.fn()

    scheduler.schedule(refresh)
    for (let index = 0; index < 19; index++) {
      jest.advanceTimersByTime(50)
      scheduler.schedule(refresh)
    }

    expect(refresh).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(49)
    expect(refresh).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(1)
    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('refreshes immediately when a throttled timer exceeds the max wait', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const refresh = jest.fn()

    scheduler.schedule(refresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(refresh)

    jest.setSystemTime(11_001)
    scheduler.schedule(refresh)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('pauses a trailing refresh while the next build is pending', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const leadingRefresh = jest.fn()
    const deferredRefresh = jest.fn()

    scheduler.schedule(leadingRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(deferredRefresh)
    scheduler.onBuilding()

    jest.advanceTimersByTime(1000)
    expect(deferredRefresh).not.toHaveBeenCalled()

    scheduler.onBuildOk()
    expect(deferredRefresh).toHaveBeenCalledTimes(1)
  })

  it('resumes scheduling when the pending build announces a server change', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const leadingRefresh = jest.fn()
    const staleRefresh = jest.fn()
    const successfulRefresh = jest.fn()

    scheduler.schedule(leadingRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(staleRefresh)
    scheduler.onBuilding()
    scheduler.schedule(successfulRefresh)
    scheduler.onBuildOk()

    expect(staleRefresh).not.toHaveBeenCalled()
    expect(successfulRefresh).not.toHaveBeenCalled()
    jest.advanceTimersByTime(100)
    expect(successfulRefresh).toHaveBeenCalledTimes(1)
  })

  it('does not let an ordinary build-ok disturb a burst', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const leadingRefresh = jest.fn()
    const deferredRefresh = jest.fn()

    scheduler.schedule(leadingRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(deferredRefresh)
    scheduler.onBuildOk()

    expect(deferredRefresh).not.toHaveBeenCalled()
    jest.advanceTimersByTime(100)
    expect(deferredRefresh).toHaveBeenCalledTimes(1)
  })

  it('resumes a deferred refresh after a build error is fixed', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const leadingRefresh = jest.fn()
    const deferredRefresh = jest.fn()

    scheduler.schedule(leadingRefresh)
    jest.advanceTimersByTime(50)
    scheduler.schedule(deferredRefresh)
    scheduler.onBuilding()
    scheduler.onBuildError()

    jest.advanceTimersByTime(1000)
    expect(leadingRefresh).toHaveBeenCalledTimes(1)
    expect(deferredRefresh).not.toHaveBeenCalled()

    scheduler.onBuildOk()
    expect(deferredRefresh).toHaveBeenCalledTimes(1)
  })

  it('makes the next update leading after an error with no deferred work', () => {
    const scheduler = new TurbopackServerComponentRefreshScheduler()
    const refresh = jest.fn()

    scheduler.schedule(refresh)
    scheduler.onBuilding()
    scheduler.onBuildError()
    scheduler.onBuildOk()
    scheduler.schedule(refresh)

    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
