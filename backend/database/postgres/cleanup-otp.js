import otpRepository from '../../repositories/postgres/otp.js';

export async function cleanupExpiredOtps() {
  return otpRepository.cleanupExpired();
}

if (process.argv[1] && process.argv[1].endsWith('cleanup-otp.js')) {
  cleanupExpiredOtps()
    .then((deleted) => {
      console.log(`🧹 Deleted ${deleted} expired or consumed OTP records.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('OTP cleanup failed:', error.message);
      process.exit(1);
    });
}
