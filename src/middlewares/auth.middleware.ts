import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
  userId?: string;
  role?: string;
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers["authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ message: "Not authenticated" });
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { userId: string; role: string };
    req.userId = decoded.userId;
    req.role = decoded.role;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid or expired token" });
    return;
  }
};

export const requireHost = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.role === "HOST" || req.role === "ADMIN" || req.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Host access required" });
    return;
  }
};

export const requireGuest = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.role === "GUEST" || req.role === "ADMIN" || req.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Guest access required" });
    return;
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.role === "ADMIN" || req.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Admin access required" });
    return;
  }
};


export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.role === "SUPER_ADMIN") {
    next();
  } else {
    res.status(403).json({ message: "Forbidden: Super Admin access required" });
    return;
  }
};