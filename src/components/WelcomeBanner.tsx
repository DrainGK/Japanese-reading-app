export function WelcomeBanner() {
  return (
    <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 animate-fade-up">
      <p className="text-lg font-semibold text-prose">
        Welcome to N2 Reader 👋
      </p>
      <p className="text-sm text-prose-secondary mt-1">
        A text tailored to your WaniKani level is waiting below.
      </p>
    </div>
  );
}
