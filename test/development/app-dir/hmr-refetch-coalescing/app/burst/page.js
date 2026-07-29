import value0 from '../shared/value-0'
import value1 from '../shared/value-1'
import value2 from '../shared/value-2'
import value3 from '../shared/value-3'
import value4 from '../shared/value-4'
import value5 from '../shared/value-5'
import value6 from '../shared/value-6'
import value7 from '../shared/value-7'

export default function Page() {
  return (
    <h1 id="revision">
      {[value0, value1, value2, value3, value4, value5, value6, value7].join(
        '|'
      )}
    </h1>
  )
}
