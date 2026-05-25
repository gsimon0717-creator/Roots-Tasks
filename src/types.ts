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
  avatar_url?: string;
  is_di: boolean;
  user_type: 'Human Super Admin' | 'DI Super Admin' | 'Human Admin' | 'DI Admin' | 'Human User' | 'DI User';
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
