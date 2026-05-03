'use client';

export function MachineUnavailable() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
      <div className="text-5xl mb-5">⚙️</div>
      <h1 className="text-xl font-semibold mb-2">Machine Unavailable</h1>
      <p className="text-[#7a7062] text-sm max-w-xs">
        This machine is currently offline or the QR code is invalid. Please try again or contact support.
      </p>
    </div>
  );
}
