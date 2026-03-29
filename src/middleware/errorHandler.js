import { config } from "../config";

function errorHandler(err, req, res, next){
  // Log Error in Development
  if (config.env === 'development') {
    console.error(err.stack);
  }

  // Error Handling in Prod
  console.log('Error: ', err.message);

  // Handle JWT Errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ message: 'Invalid token' });
  }

  // Handle Validation Errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ message: err.message });
  }

  // Handle Other Errors
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({ message: err.message || 'Internal Server Error' });
};

export default errorHandler
