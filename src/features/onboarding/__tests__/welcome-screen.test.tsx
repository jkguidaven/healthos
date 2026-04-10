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

  it('renders headline, subtitle, and Get Started CTA', () => {
    const { getByText, getByLabelText } = renderWithProviders(<WelcomeScreen />)

    expect(getByText(/Welcome to/)).toBeTruthy()
    expect(getByText(/HealthOS/)).toBeTruthy()
    expect(getByText('Get Started')).toBeTruthy()
    expect(getByLabelText('Get started')).toBeTruthy()
  })

  it('navigates to the profile screen when CTA is pressed', () => {
    const { getByLabelText } = renderWithProviders(<WelcomeScreen />)

    fireEvent.press(getByLabelText('Get started'))

    expect(mockedPush).toHaveBeenCalledTimes(1)
    expect(mockedPush).toHaveBeenCalledWith('/(onboarding)/profile')
  })
})
