/**
 * Forward a route's rejection only once.  A handler that calls next() and then
 * rejects must not trigger Express' error pipeline a second time.
 */
export function asyncHandler(handler) {
  return function asyncRouteHandler(req, res, next) {
    let forwarded = false;
    const forwardOnce = (error) => {
      if (forwarded) return undefined;
      forwarded = true;
      return next(error);
    };

    try {
      Promise.resolve(handler(req, res, forwardOnce)).catch(forwardOnce);
    } catch (error) {
      forwardOnce(error);
    }
  };
}

export default asyncHandler;
