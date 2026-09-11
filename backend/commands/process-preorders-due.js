import preorderService from '../services/preorders/preorder-service.js';

if (process.env.PREORDER_DUE_PROCESSOR !== '1') {
  console.error('PREORDER DUE PROCESSOR: set PREORDER_DUE_PROCESSOR=1 for the protected worker command.');
  process.exit(1);
}

preorderService.processDue()
  .then((result) => {
    console.log(`PREORDER DUE PROCESSOR: t60=${result.t60} t30=${result.t30} breached=${result.breached} no_show=${result.no_show} payment_expired=${result.payment_expired}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error(`PREORDER DUE PROCESSOR FAILED: ${error?.name || 'Error'}`);
    process.exit(1);
  });
