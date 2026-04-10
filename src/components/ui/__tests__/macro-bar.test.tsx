import React from 'react'
import { renderWithProviders } from '@/test-utils/render'
import { MacroBar } from '@components/ui/macro-bar'

describe('MacroBar', () => {
  it('renders with all three macros present', () => {
    const { getByText, getByTestId } = renderWithProviders(
      <MacroBar proteinG={40} carbsG={80} fatG={20} />,
    )

    // Labels
    expect(getByText('Protein')).toBeTruthy()
    expect(getByText('Carbs')).toBeTruthy()
    expect(getByText('Fat')).toBeTruthy()

    // Gram values
    expect(getByText('40g')).toBeTruthy()
    expect(getByText('80g')).toBeTruthy()
    expect(getByText('20g')).toBeTruthy()

    // All three segments rendered
    expect(getByTestId('macro-bar-segment-protein')).toBeTruthy()
    expect(getByTestId('macro-bar-segment-carbs')).toBeTruthy()
    expect(getByTestId('macro-bar-segment-fat')).toBeTruthy()
  })

  it('renders empty state when all macros are zero', () => {
    const { getByText, getAllByText, getByTestId, queryByTestId } =
      renderWithProviders(<MacroBar proteinG={0} carbsG={0} fatG={0} />)

    // Container still rendered
    expect(getByTestId('macro-bar-container')).toBeTruthy()

    // No segments rendered
    expect(queryByTestId('macro-bar-segment-protein')).toBeNull()
    expect(queryByTestId('macro-bar-segment-carbs')).toBeNull()
    expect(queryByTestId('macro-bar-segment-fat')).toBeNull()

    // Legend still shows "0g" for all three macros
    expect(getAllByText('0g')).toHaveLength(3)
    expect(getByText('Protein')).toBeTruthy()
    expect(getByText('Carbs')).toBeTruthy()
    expect(getByText('Fat')).toBeTruthy()
  })

  it('renders a single full-width segment when one macro dominates', () => {
    const { getByTestId } = renderWithProviders(
      <MacroBar proteinG={200} carbsG={0} fatG={0} />,
    )

    const protein = getByTestId('macro-bar-segment-protein')
    const carbs = getByTestId('macro-bar-segment-carbs')
    const fat = getByTestId('macro-bar-segment-fat')

    // Protein gets 100% (flexGrow 1), the others get 0
    expect(protein.props.style).toEqual(
      expect.objectContaining({ flexGrow: 1 }),
    )
    expect(carbs.props.style).toEqual(
      expect.objectContaining({ flexGrow: 0 }),
    )
    expect(fat.props.style).toEqual(expect.objectContaining({ flexGrow: 0 }))
  })

  it('clamps negative and NaN values to zero', () => {
    const { getByText, getByTestId } = renderWithProviders(
      <MacroBar proteinG={-10} carbsG={Number.NaN} fatG={30} />,
    )

    // Only fat should have a meaningful segment
    const fat = getByTestId('macro-bar-segment-fat')
    expect(fat.props.style).toEqual(expect.objectContaining({ flexGrow: 1 }))

    // Negative protein rendered as 0g, NaN carbs rendered as 0g, fat as 30g
    expect(getByText('30g')).toBeTruthy()
  })

  it('honors showLegend=false by hiding the legend row', () => {
    const { queryByText } = renderWithProviders(
      <MacroBar proteinG={10} carbsG={20} fatG={5} showLegend={false} />,
    )
    expect(queryByText('Protein')).toBeNull()
    expect(queryByText('Carbs')).toBeNull()
    expect(queryByText('Fat')).toBeNull()
  })

  it('honors showGrams=false by showing labels without grams', () => {
    const { getByText, queryByText } = renderWithProviders(
      <MacroBar proteinG={10} carbsG={20} fatG={5} showGrams={false} />,
    )
    expect(getByText('Protein')).toBeTruthy()
    expect(getByText('Carbs')).toBeTruthy()
    expect(getByText('Fat')).toBeTruthy()
    expect(queryByText('10g')).toBeNull()
    expect(queryByText('20g')).toBeNull()
    expect(queryByText('5g')).toBeNull()
  })

  it('applies the custom height prop to the container', () => {
    const { getByTestId } = renderWithProviders(
      <MacroBar proteinG={10} carbsG={10} fatG={10} height={20} />,
    )
    const container = getByTestId('macro-bar-container')
    expect(container.props.style).toEqual(
      expect.objectContaining({ height: 20 }),
    )
  })

  it('renders segment widths proportional to gram values', () => {
    // Total = 100 → protein 0.5, carbs 0.3, fat 0.2
    const { getByTestId } = renderWithProviders(
      <MacroBar proteinG={50} carbsG={30} fatG={20} />,
    )
    const protein = getByTestId('macro-bar-segment-protein')
    const carbs = getByTestId('macro-bar-segment-carbs')
    const fat = getByTestId('macro-bar-segment-fat')

    expect(protein.props.style).toEqual(
      expect.objectContaining({ flexGrow: 0.5 }),
    )
    expect(carbs.props.style).toEqual(
      expect.objectContaining({ flexGrow: 0.3 }),
    )
    expect(fat.props.style).toEqual(expect.objectContaining({ flexGrow: 0.2 }))
  })
})
