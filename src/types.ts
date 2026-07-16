export interface Organization {
  id: number;
  name: string;
  created_at: string;
}

export interface Team {
  id: number;
  organization_id: number;
  name: string;
  created_at: string;
}

export interface Project {
  id: number;
  team_id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Attachment {
  id: number;
  task_id: number | null;
  subtask_id: number | null;
  name: string;
  url: string;
  created_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  status: 'pending' | 'completed';
  created_at: string;
  attachments?: Attachment[];
}

export interface Section {
  id: number;
  project_id: number;
  name: string;
  color: string;
  order_index: number;
}

export interface User {
  id: number;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  password?: string;
  google_id?: string;
  avatar_url?: string;
  is_di: boolean;
  // BUGFIX (2026-07-10, Greg's explicit rule): Super Admin must always be a
  // Human account -- "DI Super Admin" removed. (Note: this file isn't
  // currently imported anywhere in src/ -- App.tsx defines its own User
  // interface inline -- but fixed for consistency in case that changes.)
  user_type: 'Human Super Admin' | 'Human Admin' | 'DI Admin' | 'Human User' | 'DI User';
  api_key?: string;
}

export interface UserScope {
  id: number;
  user_id: number;
  scope_type: 'organization' | 'division' | 'team' | 'project';
  scope_id: number;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'pending' | 'completed' | 'in_progress';
  priority: 'low' | 'moderate' | 'high' | 'urgent';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  organization_id?: number | null;
  team_id?: number | null;
  assignee_id?: number | null;
  project_ids?: number[];
  section_assignments?: Record<number, number | null>; // project_id -> section_id
  subtasks?: Subtask[];
  attachments?: Attachment[];
}
