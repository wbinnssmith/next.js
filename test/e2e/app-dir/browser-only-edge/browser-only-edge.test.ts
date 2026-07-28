import { nextTestSetup } from 'e2e-utils'

const describeEdgeRuntime =
  process.env.__NEXT_CACHE_COMPONENTS === 'true' ? describe.skip : describe

describeEdgeRuntime('browserOnly in the Edge Runtime', () => {
  const { next } = nextTestSetup({
    files: __dirname,
  })

  it('renders a fallback on the server and content after hydration', async () => {
    const $ = await next.render$('/')
    expect($('#edge-fallback').text()).toBe('edge fallback')
    expect($('#edge-browser-content').length).toBe(0)

    const browser = await next.browser('/')
    expect(await browser.elementByCss('#edge-browser-content').text()).toBe(
      'edge browser content'
    )
  })
})
