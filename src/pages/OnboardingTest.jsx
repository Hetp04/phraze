import InteractiveOnboardingDemo from './InteractiveOnboardingDemo';

/**
 * Test page for InteractiveOnboardingDemo component
 * Accessible at /onboarding-test for testing purposes
 * Bypasses authentication and provides mock user data
 */
export default function OnboardingTest() {
  // Mock user data for testing
  const mockUserProfileImage = null; // Can be set to a test image URL or base64 data URL
  const mockFirstName = 'Test';
  const mockLastName = 'User';
  const mockEmail = 'test@example.com';

  const handleDemoComplete = () => {
    console.log('Demo completed! This would normally redirect to demonstration page.');
    // For testing, you might want to add some visual feedback here
    alert('Demo completed! Check console for details.');
  };

  return (
    <InteractiveOnboardingDemo
      onComplete={handleDemoComplete}
      userProfileImage={mockUserProfileImage}
      userFirstName={mockFirstName}
      userLastName={mockLastName}
      userEmail={mockEmail}
    />
  );
}
