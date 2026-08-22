import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { Bullets, Chips, NumberedList, Prose, Sources } from '../../src/components/agents/parts.jsx'
import { ScoreChip, ScoreMeter } from '../../src/components/positions/ScoreChip.jsx'
import { StatusBadge } from '../../src/components/positions/PositionStatus.jsx'

describe('presentational component snapshots', () => {
  it('Bullets renders a list', () => {
    const { container } = render(<Bullets items={['Alpha', 'Beta']} tone="accent" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Chips renders tags', () => {
    const { container } = render(<Chips items={['React', 'Node']} tone="emerald" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('NumberedList renders ordered items', () => {
    const { container } = render(<NumberedList items={['First', 'Second']} />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Prose renders text', () => {
    const { container } = render(<Prose>Hello world</Prose>)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Sources renders grounded citations (only safe http links)', () => {
    const sources = [
      { title: 'Good', url: 'https://example.com' },
      { title: 'Evil', url: 'javascript:alert(1)' }, // must render as plain text
    ]
    const { container, queryByText } = render(<Sources sources={sources} grounded />)
    expect(container.querySelectorAll('a')).toHaveLength(1) // the js: link is not an anchor
    expect(queryByText('Evil')).toBeInTheDocument()
    expect(container.firstChild).toMatchSnapshot()
  })

  it('Sources shows the ungrounded note', () => {
    const { getByText } = render(<Sources sources={[]} grounded={false} />)
    expect(getByText(/model's knowledge/i)).toBeInTheDocument()
  })

  it('ScoreChip colors by band', () => {
    expect(render(<ScoreChip score={92} />).container.firstChild).toMatchSnapshot('high')
    expect(render(<ScoreChip score={75} />).container.firstChild).toMatchSnapshot('mid')
    expect(render(<ScoreChip score={40} />).container.firstChild).toMatchSnapshot('low')
  })

  it('ScoreMeter renders a bar', () => {
    expect(render(<ScoreMeter score={88} />).container.firstChild).toMatchSnapshot()
  })

  it('StatusBadge renders each pipeline status', () => {
    for (const s of ['open', 'applied', 'interviewing', 'offer', 'rejected']) {
      expect(render(<StatusBadge status={s} />).container.firstChild).toMatchSnapshot(s)
    }
  })
})
