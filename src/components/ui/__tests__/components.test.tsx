import React from 'react'
import { renderWithProviders } from '@/test-utils/render'
import { Button } from '@components/ui/button'
import { Card } from '@components/ui/card'
import { Input } from '@components/ui/input'
import { MetricTile } from '@components/ui/metric-tile'
import { ConfidenceBadge } from '@components/ui/confidence-badge'
import { SectionHeader } from '@components/ui/section-header'
import { Avatar } from '@components/ui/avatar'
import { ProgressRing } from '@components/ui/progress-ring'
import { Text } from 'react-native'

describe('UI components render', () => {
  it('renders Button primary with children', () => {
    const { getByText } = renderWithProviders(
      <Button onPress={() => undefined}>Save</Button>,
    )
    expect(getByText('Save')).toBeTruthy()
  })

  it('renders Button loading state', () => {
    const { getByLabelText, queryByText } = renderWithProviders(
      <Button onPress={() => undefined} loading>
        Save
      </Button>,
    )
    expect(getByLabelText('Loading')).toBeTruthy()
    expect(queryByText('Save')).toBeNull()
  })

  it('renders Card with children', () => {
    const { getByText } = renderWithProviders(
      <Card>
        <Text>Body</Text>
      </Card>,
    )
    expect(getByText('Body')).toBeTruthy()
  })

  it('renders Input with label, value, and hint', () => {
    const { getByText, getByDisplayValue } = renderWithProviders(
      <Input
        label="Email"
        value="hi@example.com"
        onChangeText={() => undefined}
        hint="Used for recovery"
      />,
    )
    expect(getByText('Email')).toBeTruthy()
    expect(getByText('Used for recovery')).toBeTruthy()
    expect(getByDisplayValue('hi@example.com')).toBeTruthy()
  })

  it('renders Input with error instead of hint', () => {
    const { getByText, queryByText } = renderWithProviders(
      <Input
        label="Email"
        value=""
        onChangeText={() => undefined}
        hint="Used for recovery"
        error="Required"
      />,
    )
    expect(getByText('Required')).toBeTruthy()
    expect(queryByText('Used for recovery')).toBeNull()
  })

  it('renders MetricTile with progress', () => {
    const { getByText } = renderWithProviders(
      <MetricTile
        label="Calories"
        value="1,820"
        subtitle="of 2,200"
        progress={75}
        progressColor="green"
      />,
    )
    expect(getByText('Calories')).toBeTruthy()
    expect(getByText('1,820')).toBeTruthy()
    expect(getByText('of 2,200')).toBeTruthy()
  })

  it('renders ConfidenceBadge for each type', () => {
    const { getByText, rerender } = renderWithProviders(
      <ConfidenceBadge type="high" />,
    )
    expect(getByText('AI scan · high')).toBeTruthy()
    rerender(<ConfidenceBadge type="medium" />)
    expect(getByText('AI scan · medium')).toBeTruthy()
    rerender(<ConfidenceBadge type="low" />)
    expect(getByText('Low confidence')).toBeTruthy()
    rerender(<ConfidenceBadge type="barcode" />)
    expect(getByText('Barcode scan')).toBeTruthy()
  })

  it('renders SectionHeader', () => {
    const { getByText } = renderWithProviders(
      <SectionHeader>Today</SectionHeader>,
    )
    expect(getByText('Today')).toBeTruthy()
  })

  it('renders Avatar with initials', () => {
    const { getByText } = renderWithProviders(<Avatar initials="JK" />)
    expect(getByText('JK')).toBeTruthy()
  })

  it('renders Avatar pressable when onPress is provided', () => {
    const { getByLabelText } = renderWithProviders(
      <Avatar initials="JK" onPress={() => undefined} />,
    )
    expect(getByLabelText('Avatar JK')).toBeTruthy()
  })

  it('renders ProgressRing without crashing', () => {
    const { toJSON } = renderWithProviders(
      <ProgressRing progress={42} size={64} strokeWidth={6} />,
    )
    expect(toJSON()).toBeTruthy()
  })
})
