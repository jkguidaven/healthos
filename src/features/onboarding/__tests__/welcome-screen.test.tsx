import React from 'react'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/test-utils/render'
import { WelcomeScreen } from '@features/onboarding/welcome-screen'
import { router } from 'expo-router'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}))

const mockedPush = router.push as jest.MockedFunction<typeof router.push>

describe('WelcomeScreen', () => {
  beforeEach(() => {
    mockedPush.mockClear()
  })

  it('renders app name, tagline, feature list, CTA, and trust line', () => {
    const { getByText } = renderWithProviders(<WelcomeScreen />)

    expect(getByText('HealthOS')).toBeTruthy()
    expect(getByText(/Track\. Train\. Transform\./)).toBeTruthy()
    expect(getByText('AI food scanner')).toBeTruthy()
    expect(getByText('AI workout plans')).toBeTruthy()
    expect(getByText('Body fat tracking')).toBeTruthy()
    expect(getByText('Recomp coach')).toBeTruthy()
    expect(getByText('Get started')).toBeTruthy()
    expect(
      getByText('All data stays on your device · no account needed'),
    ).toBeTruthy()
  })

  it('navigates to the profile screen when CTA is pressed', () => {
    const { getByText } = renderWithProviders(<WelcomeScreen />)

    fireEvent.press(getByText('Get started'))

    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(mockedPush).toHaveBeenCalledWith('/(onboarding)/profile')
  })
})
