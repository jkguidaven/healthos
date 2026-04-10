import React from 'react'
import { Text } from 'react-native'
import { renderWithProviders } from '@/test-utils/render'
import { ScreenLayout } from '@components/layouts/screen-layout'

describe('ScreenLayout', () => {
  it('renders children in non-scroll mode', () => {
    const { getByText } = renderWithProviders(
      <ScreenLayout>
        <Text>Hello</Text>
      </ScreenLayout>,
    )
    expect(getByText('Hello')).toBeTruthy()
  })

  it('renders children in scroll mode', () => {
    const { getByText } = renderWithProviders(
      <ScreenLayout scroll>
        <Text>Scrollable</Text>
      </ScreenLayout>,
    )
    expect(getByText('Scrollable')).toBeTruthy()
  })
})
