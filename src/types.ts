import { CourseType } from './constants';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  registerNo: string;
  department: string;
  yearSem: string;
  role: 'user' | 'admin';
  createdAt: any;
}

export interface MarkRecord {
  id: string;
  userId: string;
  userName: string;
  registerNo: string;
  department: string;
  yearSem: string;
  courseType: CourseType;
  internalMarks: number;
  eseMarks: number;
  totalMarks: number;
  scores: Record<string, string>;
  eseScore: string;
  createdAt: any;
  updatedAt: any;
}

export interface LoginLog {
  id: string;
  userId: string;
  displayName: string;
  registerNo: string;
  timestamp: any;
  userAgent: string;
}
