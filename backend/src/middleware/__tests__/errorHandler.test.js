const errorHandler = require('@/middleware/errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('errorHandler middleware', () => {
  test('returns 502 for Axios errors', () => {
    const err = { isAxiosError: true, message: 'Network Error' };
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      error: expect.objectContaining({ code: 'UPSTREAM_ERROR' }),
    }));
  });

  test('returns err.status when set', () => {
    const err = { status: 404, message: 'Not found', code: 'NOT_FOUND' };
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('falls back to 500 when no status on error', () => {
    const err = new Error('Something broke');
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 'error',
      error: expect.objectContaining({ code: 'INTERNAL_ERROR' }),
    }));
  });

  test('response always has status, error.code, error.message shape', () => {
    const err = { status: 422, code: 'VALIDATION_FAIL', message: 'Bad input' };
    const res = mockRes();

    errorHandler(err, {}, res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('status', 'error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body.error).toHaveProperty('details', null);
  });
});
