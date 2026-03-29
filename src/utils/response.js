export function success (res, data, message = 'OK') {
  res.status(200).json({
    status: true,
    message,
    data,
  });
}

export function created(res, data, message = 'Created') {
  res.status(201).json({
    status: true,
    message,
    data,
  });
}

export function error( res, message, statusCode = 500) {
  res.status(statusCode).json({
    status: false,
    error: message,
  });
}

export function notFound(res, message = 'Not Found') {
  res.status(404).json({
    status: false,
    error: message,
  });
}

export function unauthorized(res, message = 'Unauthorized') {
  res.status(401).json({
    status: false,
    error: message,
  });
}
