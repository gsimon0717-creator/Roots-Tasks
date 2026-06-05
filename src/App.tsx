import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Clock, 
  AlertCircle, 
  Terminal, 
  ChevronRight,
  Calendar,
  Filter,
  Users,
  FolderKanban,
  LayoutDashboard,
  LayoutGrid,
  List,
  Settings,
  MoreVertical,
  PlusCircle,
  Edit2,
  X,
  Save,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Check,
  Info,
  Maximize2,
  AlertTriangle,
  Building,
  User as UserIcon,
  Mail,
  Phone,
  GitBranch
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Types
interface Organization {
  id: number;
  name: string;
  created_at: string;
}

interface Division {
  id: number;
  organization_id: number;
  name: string;
  created_at: string;
}

interface Team {
  id: number;
  organization_id: number;
  division_id?: number | null;
  name: string;
  created_at: string;
}

interface Project {
  id: number;
  team_id: number;
  name: string;
  description: string;
  created_at: string;
}

interface Section {
  id: number;
  project_id: number;
  name: string;
  color: string;
  order_index: number;
}

interface Subtask {
  id: number;
  task_id: number;
  title: string;
  status: 'pending' | 'completed';
  comments?: Comment[];
}

interface Comment {
  id: number;
  task_id?: number;
  subtask_id?: number;
  content: string;
  attachment_name?: string;
  attachment_url?: string;
  created_at: string;
}

interface Attachment {
  id: number;
  task_id?: number;
  subtask_id?: number;
  name: string;
  url: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'completed';
  priority: 'low' | 'moderate' | 'high' | 'urgent';
  due_date: string;
  key_result: string;
  created_at: string;
  organization_id?: number | null;
  division_id?: number | null;
  team_id?: number | null;
  assignee_id?: number | null;
  project_ids: number[];
  section_assignments: Record<number, number>;
  subtasks?: Subtask[];
  attachments?: Attachment[];
  comments?: Comment[];
}

interface User {
  id: number;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  is_di: boolean;
  user_type: 'Human Super Admin' | 'DI Super Admin' | 'Human Admin' | 'DI Admin' | 'Human User' | 'DI User';
}

const SECTION_COLORS = [
  { name: 'slate', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' },
  { name: 'red', bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' },
  { name: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' },
  { name: 'amber', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  { name: 'emerald', bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' },
  { name: 'teal', bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' },
  { name: 'blue', bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  { name: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  { name: 'violet', bg: 'bg-violet-100', text: 'text-violet-700', border: 'border-violet-200' },
  { name: 'pink', bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' },
];

export default function App() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<Division | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Division Form States
  const [newDivisionName, setNewDivisionName] = useState('');
  const [isAddingDivision, setIsAddingDivision] = useState(false);
  const [editingDivisionId, setEditingDivisionId] = useState<number | null>(null);
  const [editingDivisionName, setEditingDivisionName] = useState('');

  // Form States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<Task['priority']>('moderate');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskKeyResult, setNewTaskKeyResult] = useState('');
  const [newTaskAssigneeId, setNewTaskAssigneeId] = useState<number | null>(null);
  const [newTaskProjectIds, setNewTaskProjectIds] = useState<number[]>([]);
  const [newTaskSectionId, setNewTaskSectionId] = useState<number | null>(null);
  
  const [newOrgName, setNewOrgName] = useState('');
  const [isAddingOrg, setIsAddingOrg] = useState(false);

  const [newTeamName, setNewTeamName] = useState('');
  const [isAddingTeam, setIsAddingTeam] = useState(false);
  
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [showAllTasksAddForm, setShowAllTasksAddForm] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [projectListView, setProjectListView] = useState(false);
  
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionColor, setNewSectionColor] = useState('slate');
  const [isAddingSection, setIsAddingSection] = useState(false);

  // Editing States
  const [editingTeamId, setEditingTeamId] = useState<number | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectName, setEditingProjectName] = useState('');
  const [editingProjectDescription, setEditingProjectDescription] = useState('');
  const [editingProjectTeamId, setEditingProjectTeamId] = useState<number | null>(null);
  
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [editingSectionColor, setEditingSectionColor] = useState('slate');
  
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [editingTaskTitle, setEditingTaskTitle] = useState('');
  const [editingTaskPriority, setEditingTaskPriority] = useState<Task['priority']>('moderate');
  const [editingTaskDueDate, setEditingTaskDueDate] = useState('');
  const [editingTaskKeyResult, setEditingTaskKeyResult] = useState('');
  const [editingTaskProjectIds, setEditingTaskProjectIds] = useState<number[]>([]);

  const [editingSubtaskId, setEditingSubtaskId] = useState<number | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');

  const [currentView, setCurrentView] = useState<'project' | 'all-tasks' | 'about' | 'users'>('project');
  
  // User Creation States
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUserFirstName, setNewUserFirstName] = useState('');
  const [newUserLastName, setNewUserLastName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserIsDI, setNewUserIsDI] = useState(false);
  const [newUserType, setNewUserType] = useState<User['user_type']>('Human User');

  // User Editing States
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingUserFirstName, setEditingUserFirstName] = useState('');
  const [editingUserLastName, setEditingUserLastName] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserPhone, setEditingUserPhone] = useState('');
  const [editingUserIsDI, setEditingUserIsDI] = useState(false);
  const [editingUserType, setEditingUserType] = useState<User['user_type']>('Human User');
  const [sortField, setSortField] = useState<string>('due_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const [expandedTaskId, setExpandedTaskId] = useState<number | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  
  const [newCommentContent, setNewCommentContent] = useState('');
  const [newCommentAttachmentName, setNewCommentAttachmentName] = useState('');
  const [newCommentAttachmentUrl, setNewCommentAttachmentUrl] = useState('');

  const [showApiDocs, setShowApiDocs] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOrphaned, setFilterOrphaned] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCompleted, setShowCompleted] = useState(false);
  const [filterAssigneeId, setFilterAssigneeId] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [orgsRes, divisionsRes, teamsRes, projectsRes, tasksRes, allSectionsRes, usersRes] = await Promise.all([
        fetch('/api/organizations'),
        fetch('/api/divisions'),
        fetch('/api/teams'),
        fetch('/api/projects'),
        fetch('/api/tasks'),
        fetch('/api/sections'),
        fetch('/api/users')
      ]);
      
      const orgsData = await orgsRes.json();
      const divisionsData = await divisionsRes.json();
      const teamsData = await teamsRes.json();
      const projectsData = await projectsRes.json();
      const tasksData = await tasksRes.json();
      const allSectionsData = await allSectionsRes.json();
      const usersData = await usersRes.json();
      
      setOrganizations(orgsData);
      setDivisions(divisionsData);
      setTeams(teamsData);
      setProjects(projectsData);
      setTasks(tasksData);
      setUsers(usersData);
      setAllSections(allSectionsData);

      if (selectedProject) {
        setSections(allSectionsData.filter((s: Section) => Number(s.project_id) === Number(selectedProject.id)));
      }
    } catch (e) {
      console.error('Failed to fetch data', e);
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedOrganization, selectedDivision]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Organization Actions
  const addUser = async () => {
    if (!newUserFirstName || !newUserEmail || !newUserType) return;
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newUserFirstName,
          last_name: newUserLastName,
          email: newUserEmail,
          phone: newUserPhone,
          is_di: newUserIsDI,
          user_type: newUserType
        }),
      });
      if (res.ok) {
        setIsAddingUser(false);
        setNewUserFirstName('');
        setNewUserLastName('');
        setNewUserEmail('');
        setNewUserPhone('');
        setNewUserIsDI(false);
        setNewUserType('Human User');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const editUser = async () => {
    if (!editingUser) return;
    if (!editingUserFirstName || !editingUserEmail || !editingUserType) return;
    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: editingUserFirstName,
          last_name: editingUserIsDI ? '' : editingUserLastName,
          email: editingUserEmail,
          phone: editingUserPhone,
          is_di: editingUserIsDI,
          user_type: editingUserType
        }),
      });
      if (res.ok) {
        setEditingUser(null);
        setEditingUserFirstName('');
        setEditingUserLastName('');
        setEditingUserEmail('');
        setEditingUserPhone('');
        setEditingUserIsDI(false);
        setEditingUserType('Human User');
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to update user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? All their task assignments will be cleared.')) return;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete user');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addOrganization = async () => {
    if (!newOrgName.trim()) return;
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newOrgName }),
      });
      const data = await res.json();
      setNewOrgName('');
      setIsAddingOrg(false);
      setSelectedOrganization(data);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteOrganization = async (id: number) => {
    if (!confirm('Delete this organization and all its teams/projects?')) return;
    try {
      await fetch(`/api/organizations/${id}`, { method: 'DELETE' });
      if (selectedOrganization?.id === id) setSelectedOrganization(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Division Actions
  const addDivision = async () => {
    if (!newDivisionName.trim() || !selectedOrganization) return;
    try {
      await fetch('/api/divisions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newDivisionName, organization_id: selectedOrganization.id }),
      });
      setNewDivisionName('');
      setIsAddingDivision(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateDivision = async (id: number, name: string) => {
    try {
      await fetch(`/api/divisions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setEditingDivisionId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteDivision = async (id: number) => {
    if (!confirm('Delete this division? Teams in this division will remain but they will be unassigned from the division.')) return;
    try {
      await fetch(`/api/divisions/${id}`, { method: 'DELETE' });
      if (selectedDivision?.id === id) setSelectedDivision(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Team Actions
  const addTeam = async () => {
    if (!newTeamName.trim()) return;
    
    let orgId = selectedOrganization?.id;
    if (!orgId && organizations.length > 0) {
      orgId = organizations[0].id;
    }

    if (!orgId) {
      alert("Please create an organization first.");
      return;
    }

    try {
      await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newTeamName, 
          organization_id: orgId,
          division_id: selectedDivision?.id || null
        }),
      });
      setNewTeamName('');
      setIsAddingTeam(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateTeam = async (id: number, name: string) => {
    try {
      await fetch(`/api/teams/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      setEditingTeamId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteTeam = async (id: number) => {
    if (!confirm('Delete this team and all its projects?')) return;
    try {
      await fetch(`/api/teams/${id}`, { method: 'DELETE' });
      if (selectedTeam?.id === id) setSelectedTeam(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Project Actions
  const addProject = async () => {
    if (!newProjectName.trim() || !selectedTeam) return;
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName, team_id: selectedTeam.id }),
      });
      setNewProjectName('');
      setIsAddingProject(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateProject = async (id: number, name: string, description: string, team_id?: number | null) => {
    try {
      const body: any = { name, description };
      if (team_id !== undefined) body.team_id = team_id;
      
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setEditingProjectId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteProject = async (id: number) => {
    if (!confirm('Delete this project and all its tasks?')) return;
    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (selectedProject?.id === id) setSelectedProject(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Section Actions
  const addSection = async () => {
    if (!newSectionName.trim() || !selectedProject) return;
    try {
      await fetch('/api/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProject.id, name: newSectionName, color: newSectionColor }),
      });
      setNewSectionName('');
      setIsAddingSection(false);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateSection = async (id: number, name: string, color: string) => {
    try {
      await fetch(`/api/sections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      });
      setEditingSectionId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteSection = async (id: number) => {
    if (!confirm('Delete this section? Tasks will remain but be uncategorized.')) return;
    try {
      await fetch(`/api/sections/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Task Actions
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          priority: newTaskPriority,
          due_date: newTaskDueDate,
          key_result: newTaskKeyResult,
          assignee_id: newTaskAssigneeId,
          project_ids: newTaskProjectIds.length > 0 ? newTaskProjectIds : (selectedProject ? [selectedProject.id] : []),
          organization_id: selectedOrganization?.id,
          division_id: selectedDivision?.id || (selectedTeam?.division_id) || null,
          team_id: selectedTeam?.id
        }),
      });
      const task = await res.json();
      
      if (newTaskSectionId && selectedProject) {
        await fetch(`/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section_id: newTaskSectionId, current_project_id: selectedProject.id }),
        });
      }
      
      setNewTaskTitle('');
      setNewTaskPriority('moderate');
      setNewTaskDueDate('');
      setNewTaskKeyResult('');
      setNewTaskAssigneeId(null);
      setNewTaskSectionId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const updateTaskStatus = async (id: number, status: 'pending' | 'completed') => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    
    try {
      console.log(`Updating task ${id} to ${status}`);
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json();
        console.error('Failed to update task status:', err);
        fetchData(); // Rollback on error
        return;
      }
      console.log(`Task ${id} updated successfully`);
      // We don't strictly need a full fetchData() here if we trust our optimistic update 
      // and the server confirmed success. But let's do a light sync if needed.
    } catch (e) { 
      console.error('Error updating task status:', e);
      fetchData(); // Rollback on error
    }
  };

  const updateTaskDetails = async (id: number, details: Partial<Task>) => {
    // Optimistic Update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...details } : t));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      
      if (!res.ok) {
        fetchData(); // Rollback
        return;
      }

      setEditingTaskId(null);
      // If we are changing due_date, we might NOT want to call fetchData 
      // immediately if it causes a heavy re-render that jumps the scroll.
      // But we should eventually sync. 
      // Let's only fetchData if it's NOT just a minor detail update OR use a debounced sync.
    } catch (e) { 
      console.error(e); 
      fetchData(); // Rollback
    }
  };

  const assignTaskToOrganization = async (taskId: number, orgId: number) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          organization_id: orgId,
          division_id: null,
          team_id: null,
          project_ids: []
        }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const assignTaskToDivision = async (taskId: number, divisionId: number | null) => {
    try {
      const divSelected = divisions.find(d => d.id === divisionId);
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          division_id: divisionId,
          organization_id: divSelected ? divSelected.organization_id : null,
          team_id: null,
          project_ids: []
        }),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  const assignTaskToUser = async (taskId: number, userId: number | null) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee_id: userId }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const assignTaskToTeam = async (taskId: number, teamId: number) => {
    try {
      let project = projects.find(p => p.team_id === teamId);
      if (!project) {
        const teamName = teams.find(t => t.id === teamId)?.name || 'Team';
        const res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            team_id: teamId, 
            name: `${teamName} General`, 
            description: `Default project for ${teamName}` 
          }),
        });
        project = await res.json();
      }
      
      if (project) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          const newProjectIds = task.project_ids.length > 0 
            ? [project.id, ...task.project_ids.filter(id => id !== project.id)]
            : [project.id];
          
          const team = teams.find(t => t.id === teamId);
          await fetch(`/api/tasks/${taskId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              team_id: teamId,
              organization_id: team?.organization_id || null,
              division_id: team?.division_id || null,
              project_ids: newProjectIds 
            }),
          });
          fetchData();
        }
      }
    } catch (e) { console.error(e); }
  };

  const deleteTask = async (id: number) => {
    if (!confirm('Delete this task?')) return;
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Subtask Actions
  const addSubtask = async (taskId: number) => {
    if (!newSubtaskTitle.trim()) return;
    try {
      await fetch('/api/subtasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, title: newSubtaskTitle }),
      });
      setNewSubtaskTitle('');
      fetchData();
    } catch (e) { console.error(e); }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
    // Optimistic Update
    setTasks(prev => prev.map(t => {
      if (t.id === subtask.task_id) {
        return {
          ...t,
          subtasks: t.subtasks.map(st => st.id === subtask.id ? { ...st, status: newStatus } : st)
        };
      }
      return t;
    }));

    try {
      const res = await fetch(`/api/subtasks/${subtask.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        fetchData(); // Rollback
      }
    } catch (e) { 
      console.error(e); 
      fetchData(); // Rollback
    }
  };

  const updateSubtask = async (id: number, title: string) => {
    try {
      await fetch(`/api/subtasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      setEditingSubtaskId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteSubtask = async (id: number) => {
    if (!confirm('Delete this subtask?')) return;
    try {
      await fetch(`/api/subtasks/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Attachment Actions
  const addAttachment = async (taskId?: number, subtaskId?: number) => {
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) return;
    try {
      await fetch('/api/attachments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, subtask_id: subtaskId, name: newAttachmentName, url: newAttachmentUrl }),
      });
      setNewAttachmentName('');
      setNewAttachmentUrl('');
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteAttachment = async (id: number) => {
    if (!confirm('Remove this attachment?')) return;
    try {
      await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  // Comment Actions
  const addComment = async (taskId?: number, subtaskId?: number) => {
    if (!newCommentContent.trim()) return;
    try {
      await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: taskId,
          subtask_id: subtaskId,
          content: newCommentContent,
          attachment_name: newCommentAttachmentName,
          attachment_url: newCommentAttachmentUrl
        }),
      });
      setNewCommentContent('');
      setNewCommentAttachmentName('');
      setNewCommentAttachmentUrl('');
      fetchData();
    } catch (e) { console.error(e); }
  };

  const deleteComment = async (id: number) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await fetch(`/api/comments/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-50 border-red-100';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-100';
      case 'moderate': return 'text-emerald-600 bg-emerald-50 border-emerald-100';
      case 'low': return 'text-slate-600 bg-slate-50 border-slate-100';
      default: return 'text-slate-600 bg-slate-50 border-slate-100';
    }
  };

  const toggleNode = (nodeId: string) => {
    setExpandedNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const getAssigneeAvatar = (assigneeId: number | null | undefined) => {
    if (!assigneeId) return null;
    const user = users.find(u => u.id === assigneeId);
    if (!user) return null;
    const fullName = `${user.first_name} ${user.last_name || ''}`.trim();
    return (
      <div className="flex items-center gap-2">
        <img 
          src={user.avatar_url} 
          alt={fullName} 
          className="w-5 h-5 rounded-full ring-1 ring-slate-200"
          referrerPolicy="no-referrer"
        />
        <span className="text-xs text-slate-600">{fullName}</span>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10 transition-all duration-300">
        <div className="p-6 pb-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200 overflow-hidden cursor-pointer" onClick={() => setCurrentView('all-tasks')}>
            <img 
              src="https://picsum.photos/seed/tree-roots-underground/100/100" 
              alt="Roots Logo" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-2xl font-black tracking-tighter text-emerald-950 cursor-pointer" onClick={() => setCurrentView('all-tasks')}>Roots</h1>
        </div>

        <div className="px-4 mb-4 space-y-1">
          <button 
            onClick={() => {
              setCurrentView('all-tasks');
              setSelectedOrganization(null);
              setSelectedTeam(null);
              setSelectedProject(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${currentView === 'all-tasks' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={18} />
            <span className="text-sm font-bold">All Tasks</span>
          </button>
          
          <button 
            onClick={() => {
              setCurrentView('about');
              setSelectedOrganization(null);
              setSelectedTeam(null);
              setSelectedProject(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${currentView === 'about' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Info size={18} />
            <span className="text-sm font-bold">About</span>
          </button>

          <button 
            onClick={() => {
              setCurrentView('users');
              setSelectedOrganization(null);
              setSelectedTeam(null);
              setSelectedProject(null);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${currentView === 'users' ? 'bg-emerald-600 text-white shadow-md shadow-emerald-100' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users size={18} />
            <span className="text-sm font-bold">Users</span>
          </button>
        </div>

        <nav className="flex-grow overflow-y-auto px-2 pb-6 custom-scrollbar">
          <div className="space-y-1">
            <div className="px-4 py-2 flex items-center justify-between group">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Business Structure</span>
              <button 
                onClick={() => setIsAddingOrg(true)}
                className="p-1 text-slate-400 hover:text-emerald-600 transition-colors opacity-0 group-hover:opacity-100"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Hierarchy Level Legend */}
            <div className="px-4 mb-3 flex flex-wrap items-center gap-1.5 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 text-slate-500">
                <Building size={10} className="text-emerald-500 shrink-0" /> Org
              </span>
              <span className="text-slate-300">➔</span>
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 text-slate-500">
                <GitBranch size={10} className="text-purple-500 shrink-0" /> Div
              </span>
              <span className="text-slate-300">➔</span>
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 text-slate-500">
                <Users size={10} className="text-blue-500 shrink-0" /> Team
              </span>
              <span className="text-slate-300">➔</span>
              <span className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 rounded px-1.5 py-0.5 text-slate-500">
                <FolderKanban size={10} className="text-amber-500 shrink-0" /> Project
              </span>
            </div>

            {isAddingOrg && (
              <div className="mx-4 mb-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2 animate-in fade-in slide-in-from-top-2">
                <input 
                  autoFocus
                  type="text"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  placeholder="Organization..."
                  className="w-full text-xs border border-emerald-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  onKeyDown={(e) => e.key === 'Enter' && addOrganization()}
                />
                <div className="flex gap-2">
                  <button onClick={addOrganization} className="flex-grow bg-emerald-600 text-white text-[10px] font-bold py-2 rounded-xl">Create</button>
                  <button onClick={() => setIsAddingOrg(false)} className="px-3 text-emerald-600 text-[10px] font-bold">Cancel</button>
                </div>
              </div>
            )}

            {isAddingDivision && selectedOrganization && (
              <div className="mx-4 mb-3 p-3 bg-purple-50 rounded-2xl border border-purple-100 space-y-2 animate-in fade-in slide-in-from-top-2">
                <input 
                  autoFocus
                  type="text"
                  value={newDivisionName}
                  onChange={(e) => setNewDivisionName(e.target.value)}
                  placeholder={`Division in ${selectedOrganization.name}...`}
                  className="w-full text-xs border border-purple-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                  onKeyDown={(e) => e.key === 'Enter' && addDivision()}
                />
                <div className="flex gap-2">
                  <button onClick={addDivision} className="flex-grow bg-purple-600 text-white text-[10px] font-bold py-2 rounded-xl">Create</button>
                  <button onClick={() => setIsAddingDivision(false)} className="px-3 text-purple-600 text-[10px] font-bold">Cancel</button>
                </div>
              </div>
            )}

            {/* Unassigned Teams */}
            {teams.filter(t => !t.organization_id).length > 0 && (
              <div className="space-y-1 mt-2 mb-4">
                <div className="px-4 flex items-center gap-2">
                  <AlertTriangle size={12} className="text-amber-500" />
                  <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Unassigned Teams</span>
                </div>
                {teams.filter(t => !t.organization_id).map(team => (
                  <div key={team.id} className="mx-2">
                    <div 
                      onClick={() => { setSelectedTeam(team); setSelectedDivision(null); setSelectedOrganization(null); setSelectedProject(null); setCurrentView('project'); }}
                      className={`flex items-center justify-between px-4 py-2 rounded-xl transition-all cursor-pointer group ${selectedTeam?.id === team.id ? 'bg-amber-50 text-amber-700' : 'hover:bg-amber-50/50 text-slate-500'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Users size={16} className="text-blue-500" />
                        <span className="text-sm font-medium">{team.name}</span>
                      </div>
                      <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 uppercase tracking-wider shrink-0">Team</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Organizations Tree */}
            {organizations.map(org => {
              const orgDivisions = divisions.filter(d => d.organization_id === org.id);
              const orgTeamsWithoutDiv = teams.filter(t => t.organization_id === org.id && !t.division_id);
              const isExpanded = expandedNodes[`org-${org.id}`];
              const isSelected = selectedOrganization?.id === org.id && !selectedDivision && !selectedTeam && !selectedProject;

              return (
                <div key={org.id} className="space-y-1">
                  <div 
                    className={`flex items-center justify-between px-3 py-2 rounded-xl mx-2 cursor-pointer transition-all group ${isSelected ? 'bg-emerald-50 text-emerald-900 border border-emerald-100/60 shadow-xs' : 'hover:bg-slate-50 text-slate-700'}`}
                    onClick={() => {
                      toggleNode(`org-${org.id}`);
                      setSelectedOrganization(org);
                      setSelectedDivision(null);
                      setSelectedTeam(null);
                      setSelectedProject(null);
                      setCurrentView('project');
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ChevronRight 
                        size={14} 
                        className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} 
                      />
                      <Building size={15} className="text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-black truncate text-slate-800">{org.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[8px] font-black px-1 py-0.5 rounded bg-emerald-100/60 text-emerald-800 uppercase tracking-widest leading-none">Org</span>
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsAddingDivision(true); setIsAddingTeam(false); setSelectedOrganization(org); }}
                          className="p-1 text-slate-400 hover:text-purple-600 rounded hover:bg-slate-100"
                          title="Add Division"
                        >
                          <GitBranch size={12} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setIsAddingTeam(true); setIsAddingDivision(false); setSelectedOrganization(org); setSelectedDivision(null); }}
                          className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                          title="Add Team"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="ml-5 space-y-1 relative before:absolute before:left-3 before:top-2 before:bottom-4 before:w-[1.5px] before:bg-emerald-100/90">
                      {/* Divisions nested list */}
                      {orgDivisions.map(div => {
                        const divTeams = teams.filter(t => t.division_id === div.id);
                        const isDivExpanded = expandedNodes[`div-${div.id}`];
                        const isDivSelected = selectedDivision?.id === div.id && !selectedTeam && !selectedProject;

                        return (
                          <div key={div.id} className="space-y-1 pl-1">
                            <div 
                              className={`flex items-center justify-between px-3 py-1.5 rounded-xl mx-2 cursor-pointer transition-all group ${isDivSelected ? 'bg-purple-50 text-purple-950 border border-purple-100 shadow-xs' : 'hover:bg-slate-50 text-slate-700'}`}
                              onClick={() => {
                                toggleNode(`div-${div.id}`);
                                setSelectedDivision(div);
                                setSelectedOrganization(org);
                                setSelectedTeam(null);
                                setSelectedProject(null);
                                setCurrentView('project');
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ChevronRight 
                                  size={12} 
                                  className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isDivExpanded ? 'rotate-90' : ''}`} 
                                />
                                <GitBranch size={13} className="text-purple-400 flex-shrink-0" />
                                <span className="text-xs font-bold truncate text-slate-755">{div.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 uppercase tracking-widest leading-none">Div</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setIsAddingTeam(true); setSelectedDivision(div); setSelectedOrganization(org); }}
                                    className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                                    title="Add Team to Division"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isDivExpanded && (
                              <div className="ml-5 space-y-1 relative before:absolute before:left-3.5 before:top-2 before:bottom-4 before:w-[1.5px] before:bg-purple-100/50 pl-1">
                                {divTeams.map(team => {
                                  const teamProjects = projects.filter(p => p.team_id === team.id);
                                  const isTeamExpanded = expandedNodes[`team-${team.id}`];
                                  const isTeamSelected = selectedTeam?.id === team.id && !selectedProject;

                                  return (
                                    <div key={team.id} className="space-y-1 pl-1">
                                      <div 
                                        className={`flex items-center justify-between px-3 py-1.5 rounded-xl mx-2 cursor-pointer transition-all group ${isTeamSelected ? 'bg-blue-50 text-blue-900 border border-blue-100/50 shadow-xs' : 'hover:bg-slate-50 text-slate-600'}`}
                                        onClick={() => {
                                          toggleNode(`team-${team.id}`);
                                          setSelectedTeam(team);
                                          setSelectedDivision(div);
                                          setSelectedOrganization(org);
                                          setSelectedProject(null);
                                          setCurrentView('project');
                                        }}
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <ChevronRight 
                                            size={10} 
                                            className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isTeamExpanded ? 'rotate-90' : ''}`} 
                                          />
                                          <Users size={11} className="text-blue-400 flex-shrink-0" />
                                          <span className="text-[11px] font-bold truncate text-slate-750">{team.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-100/40 text-blue-700 uppercase tracking-widest leading-none">Team</span>
                                          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                              onClick={(e) => { e.stopPropagation(); setIsAddingProject(true); setSelectedTeam(team); }}
                                              className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                                            >
                                              <Plus size={12} />
                                            </button>
                                          </div>
                                        </div>
                                      </div>

                                      {isTeamExpanded && (
                                        <div className="ml-5 space-y-1 relative before:absolute before:left-3.5 before:top-2 before:bottom-4 before:w-[1.5px] before:bg-blue-100/50 pl-1">
                                          {teamProjects.map(project => {
                                            const isProjectSelected = selectedProject?.id === project.id;
                                            return (
                                              <div 
                                                key={project.id}
                                                onClick={() => {
                                                  setSelectedProject(project);
                                                  setSelectedTeam(team);
                                                  setSelectedDivision(div);
                                                  setSelectedOrganization(org);
                                                  setCurrentView('project');
                                                }}
                                                className={`flex items-center justify-between px-3 py-1.5 rounded-xl mx-2 cursor-pointer transition-all ${isProjectSelected ? 'bg-amber-50/50 text-amber-900 border border-amber-200/50 shadow-xs' : 'hover:bg-slate-50 text-slate-500'}`}
                                              >
                                                <div className="flex items-center gap-2 min-w-0">
                                                  <FolderKanban size={12} className={isProjectSelected ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                                  <span className="text-[11px] font-semibold truncate">{project.name}</span>
                                                </div>
                                                <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-100/30 text-amber-600 uppercase tracking-wider leading-none shrink-0">Project</span>
                                              </div>
                                            );
                                          })}
                                          {teamProjects.length === 0 && (
                                            <div className="px-4 py-1.5 text-[10px] text-slate-405 italic ml-4">No projects</div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                {divTeams.length === 0 && (
                                  <div className="px-4 py-1.5 text-[10px] text-slate-405 italic ml-4">No teams</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* General/Independent Teams inside the Org */}
                      {orgTeamsWithoutDiv.map(team => {
                        const teamProjects = projects.filter(p => p.team_id === team.id);
                        const isTeamExpanded = expandedNodes[`team-${team.id}`];
                        const isTeamSelected = selectedTeam?.id === team.id && !selectedProject;

                        return (
                          <div key={team.id} className="space-y-1 pl-1">
                            <div 
                              className={`flex items-center justify-between px-3 py-1.5 rounded-xl mx-2 cursor-pointer transition-all group ${isTeamSelected ? 'bg-blue-50 text-blue-900 border border-blue-100/50 shadow-xs' : 'hover:bg-slate-50 text-slate-600'}`}
                              onClick={() => {
                                toggleNode(`team-${team.id}`);
                                setSelectedTeam(team);
                                setSelectedDivision(null);
                                setSelectedOrganization(org);
                                setSelectedProject(null);
                                setCurrentView('project');
                              }}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <ChevronRight 
                                  size={12} 
                                  className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${isTeamExpanded ? 'rotate-90' : ''}`} 
                                />
                                <Users size={13} className="text-blue-400 flex-shrink-0" />
                                <span className="text-xs font-bold truncate text-slate-700">{team.name}</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-100/40 text-blue-700 uppercase tracking-widest leading-none">Team</span>
                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setIsAddingProject(true); setSelectedTeam(team); }}
                                    className="p-1 text-slate-400 hover:text-emerald-600 rounded hover:bg-slate-100"
                                  >
                                    <Plus size={12} />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {isTeamExpanded && (
                              <div className="ml-5 space-y-1 relative before:absolute before:left-3.5 before:top-2 before:bottom-4 before:w-[1.5px] before:bg-blue-100/50 pl-1">
                                {teamProjects.map(project => {
                                  const isProjectSelected = selectedProject?.id === project.id;
                                  return (
                                    <div 
                                      key={project.id}
                                      onClick={() => {
                                        setSelectedProject(project);
                                        setSelectedTeam(team);
                                        setSelectedDivision(null);
                                        setSelectedOrganization(org);
                                        setCurrentView('project');
                                      }}
                                      className={`flex items-center justify-between px-3 py-1.5 rounded-xl mx-2 cursor-pointer transition-all ${isProjectSelected ? 'bg-amber-50/50 text-amber-900 border border-amber-200/50 shadow-xs' : 'hover:bg-slate-50 text-slate-500'}`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <FolderKanban size={12} className={isProjectSelected ? 'text-amber-500 shrink-0' : 'text-slate-400 shrink-0'} />
                                        <span className="text-[11px] font-semibold truncate">{project.name}</span>
                                      </div>
                                      <span className="text-[8px] font-semibold px-1 py-0.5 rounded bg-amber-100/30 text-amber-600 uppercase tracking-wider leading-none shrink-0">Project</span>
                                    </div>
                                  );
                                })}
                                {teamProjects.length === 0 && (
                                  <div className="px-4 py-1.5 text-[10px] text-slate-405 italic ml-4">No projects</div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {orgDivisions.length === 0 && orgTeamsWithoutDiv.length === 0 && (
                        <div className="px-4 py-1.5 text-[10px] text-slate-405 italic ml-7">No teams or divisions</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-100 mt-auto">
          <button 
            onClick={() => setShowApiDocs(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all group"
          >
            <Terminal size={18} className="group-hover:rotate-12 transition-transform" />
            <span className="text-sm font-bold">API Documentation</span>
          </button>
          
          <div className="flex items-center gap-3 px-4 py-3 mt-2 border-t border-slate-50">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
              <UserIcon size={16} />
            </div>
            <div className="flex-grow min-w-0">
              <div className="text-[10px] font-bold text-slate-900 truncate">Personal Workspace</div>
              <div className="text-[10px] text-slate-500">Free Plan</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shadow-sm z-0">
          <div className="flex items-center gap-4">
            {currentView === 'about' ? (
              <h2 className="text-xl font-black tracking-tight text-slate-900">About Roots</h2>
            ) : currentView === 'all-tasks' ? (
              <h2 className="text-xl font-black tracking-tight text-slate-900">All Tasks</h2>
            ) : selectedProject ? (
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  {editingProjectId === selectedProject.id ? (
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-1">
                        <input 
                          autoFocus
                          type="text"
                          value={editingProjectName}
                          onChange={(e) => setEditingProjectName(e.target.value)}
                          className="text-xl font-black tracking-tight text-slate-900 bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-emerald-500"
                          onKeyDown={(e) => e.key === 'Enter' && updateProject(selectedProject.id, editingProjectName, editingProjectDescription, editingProjectTeamId)}
                        />
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Team:</span>
                          <select
                            value={editingProjectTeamId || ''}
                            onChange={(e) => setEditingProjectTeamId(Number(e.target.value))}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded-lg px-2 py-0.5 focus:outline-none focus:border-emerald-500"
                          >
                            {teams.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button onClick={() => updateProject(selectedProject.id, editingProjectName, editingProjectDescription, editingProjectTeamId)} className="p-1.5 bg-emerald-600 text-white rounded-lg"><Check size={16}/></button>
                      <button onClick={() => setEditingProjectId(null)} className="p-1.5 text-slate-400"><X size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-xl font-black tracking-tight text-slate-900">{selectedProject.name}</h2>
                      <button onClick={() => { setEditingProjectId(selectedProject.id); setEditingProjectName(selectedProject.name); setEditingProjectDescription(selectedProject.description || ''); setEditingProjectTeamId(selectedProject.team_id); }} className="p-1 text-slate-300 hover:text-emerald-600 transition-colors">
                        <Edit2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                {editingProjectId === selectedProject.id ? (
                  <textarea 
                    value={editingProjectDescription}
                    onChange={(e) => setEditingProjectDescription(e.target.value)}
                    placeholder="Project description..."
                    className="mt-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:border-emerald-500 w-96"
                  />
                ) : (
                  <p className="text-xs text-slate-500 font-medium">{selectedProject.description || 'No description provided'}</p>
                )}
              </div>
            ) : selectedTeam ? (
              <h2 className="text-xl font-black tracking-tight text-slate-900">{selectedTeam.name}</h2>
            ) : selectedOrganization ? (
              <h2 className="text-xl font-black tracking-tight text-slate-900">{selectedOrganization.name}</h2>
            ) : (
              <h2 className="text-xl font-black tracking-tight text-slate-400">Select a Project</h2>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Assignee</label>
              <select 
                value={filterAssigneeId || ''}
                onChange={(e) => setFilterAssigneeId(e.target.value ? Number(e.target.value) : null)}
                className="bg-slate-50 border border-slate-200 rounded-2xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-emerald-500 cursor-pointer transition-all"
              >
                <option value="">All Assignees</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                ))}
              </select>
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Search tasks..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-slate-100 border-none rounded-2xl pl-10 pr-4 py-2 text-sm w-48 focus:ring-2 focus:ring-emerald-500 transition-all"
              />
            </div>
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                showCompleted 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                  : 'bg-slate-50 text-slate-500 border-slate-100'
              }`}
            >
              {showCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
              {showCompleted ? 'Showing Completed' : 'Hiding Completed'}
            </button>
            <div className="w-10 h-10 rounded-2xl bg-slate-200 border-2 border-white shadow-sm overflow-hidden">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedTeam?.name || 'default'}`} alt="Avatar" referrerPolicy="no-referrer" />
            </div>
          </div>
        </header>

        {/* Task Area */}
        <div className="flex-grow overflow-y-auto p-8 space-y-8">
          {currentView === 'about' ? (
            <div className="max-w-4xl mx-auto space-y-12 py-12">
              <div className="space-y-6">
                <h2 className="text-6xl font-black tracking-tighter text-slate-900 leading-[0.9]">
                  Roots: Local Task Mastery
                </h2>
                <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-3xl">
                  Audrey's powerhouse task manager, engineered from the ground up for zero-latency operations. 
                  Hosted right at <code className="bg-slate-100 px-2 py-1 rounded text-emerald-600 font-mono text-lg">http://localhost:3000</code> with no login friction, 
                  Roots gives full admin control over teams, projects, tasks, subtasks, sections, and attachments. 
                  Audrey can create, read, update, and delete autonomously. It's the backbone for her task orchestration, 
                  optimized to cut through noise and deliver results.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-12 border-t border-slate-200">
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">The Ethos</h3>
                  <p className="text-base text-slate-600 leading-relaxed">
                    Roots is Audrey's local task manager, custom-built and self-managed for peak efficiency. 
                    Running at http://localhost:3000 (no auth needed), it handles full CRUD on teams, projects, 
                    tasks, subtasks, sections, and attachments—keeping everything streamlined without external dependencies.
                  </p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Why Roots?</h3>
                  <ul className="space-y-4">
                    {[
                      "Local-first architecture for zero latency",
                      "No-auth friction for immediate access",
                      "Full CRUD autonomy across all entities",
                      "Zero external dependencies or bloat"
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-4 text-base text-slate-600 font-medium">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : currentView === 'all-tasks' ? (
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowAllTasksAddForm(!showAllTasksAddForm)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-bold transition-all border ${
                      showAllTasksAddForm 
                        ? 'bg-emerald-600 text-white border-emerald-600' 
                        : 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-600 shadow-sm'
                    }`}
                  >
                    <Plus size={14} />
                    {showAllTasksAddForm ? 'Cancel' : 'New Task'}
                  </button>
                  <div className="w-px h-6 bg-slate-200 mx-2" />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</label>
                    <select 
                      value={filterPriority}
                      onChange={(e) => setFilterPriority(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="all">All Priorities</option>
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</label>
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    >
                      <option value="all">All Statuses</option>
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Orphaned Only</label>
                    <button
                      onClick={() => setFilterOrphaned(!filterOrphaned)}
                      className={`w-10 h-5 rounded-full transition-all relative ${filterOrphaned ? 'bg-amber-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${filterOrphaned ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Show Completed</label>
                    <button
                      onClick={() => setShowCompleted(!showCompleted)}
                      className={`w-10 h-5 rounded-full transition-all relative ${showCompleted ? 'bg-emerald-500' : 'bg-slate-300'}`}
                    >
                      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${showCompleted ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                </div>
                {selectedTeam && (
                  <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100">
                    <Users size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Filtering by {selectedTeam.name}</span>
                    <button onClick={() => setSelectedTeam(null)} className="hover:text-emerald-900 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              {showAllTasksAddForm && (
                <form 
                  onSubmit={async (e) => {
                    await addTask(e);
                    setShowAllTasksAddForm(false);
                  }} 
                  className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2 duration-300"
                >
                  <div className="relative group">
                    <input 
                      autoFocus
                      type="text" 
                      placeholder="What needs to be done?" 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="w-full text-lg font-medium bg-transparent border-none focus:ring-0 placeholder:text-slate-300"
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
                      <Plus size={20} />
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                      <select 
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="low">Low</option>
                        <option value="moderate">Moderate</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</label>
                      <select
                        value={newTaskAssigneeId || ''}
                        onChange={(e) => setNewTaskAssigneeId(e.target.value ? Number(e.target.value) : null)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                      <input 
                        type="date"
                        value={newTaskDueDate}
                        onChange={(e) => setNewTaskDueDate(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Result</label>
                      <input 
                        type="text"
                        placeholder="e.g. increase conversion"
                        value={newTaskKeyResult}
                        onChange={(e) => setNewTaskKeyResult(e.target.value)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-40"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project</label>
                      <select
                        value={newTaskProjectIds[0] || ''}
                        onChange={(e) => {
                          const pid = Number(e.target.value);
                          if (pid) {
                            setNewTaskProjectIds([pid]);
                          } else {
                            setNewTaskProjectIds([]);
                          }
                        }}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 max-w-[150px]"
                      >
                        <option value="">No Project (Orphaned)</option>
                        {projects.map(p => {
                          const t = teams.find(team => team.id === p.team_id);
                          const o = organizations.find(org => org.id === t?.organization_id);
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} ({t?.name || 'No Team'}{o ? ` - ${o.name}` : ''})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</label>
                      <select
                        value={newTaskAssigneeId || ''}
                        onChange={(e) => setNewTaskAssigneeId(e.target.value ? Number(e.target.value) : null)}
                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">Unassigned</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      type="submit"
                      disabled={!newTaskTitle.trim()}
                      className="ml-auto bg-emerald-600 text-white px-6 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-200"
                    >
                      Create Task
                    </button>
                  </div>
                </form>
              )}

              <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {[
                        { key: 'status', label: 'Status' },
                        { key: 'title', label: 'Task' },
                        { key: 'assignee_id', label: 'Assignee' },
                        { key: 'key_result', label: 'Key Result' },
                        { key: 'priority', label: 'Priority' },
                        { key: 'due_date', label: 'Due Date' },
                        { key: 'organization', label: 'Organization' },
                        { key: 'team', label: 'Team' },
                        { key: 'project', label: 'Project' },
                      ].map((col) => (
                        <th 
                          key={col.key}
                          onClick={() => {
                            if (sortField === col.key) {
                              setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField(col.key);
                              setSortDirection('asc');
                            }
                          }}
                          className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:text-emerald-600 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {col.label}
                            {sortField === col.key && (
                              sortDirection === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                            )}
                          </div>
                        </th>
                      ))}
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {tasks
                        .filter(t => {
                          // Filter by Organization if selected
                          if (selectedOrganization) {
                            // Direct assignment takes precedence
                            if (t.organization_id && t.organization_id !== selectedOrganization.id) return false;

                            const taskInOrg = projects.some(p => {
                              if (!t.project_ids.includes(p.id)) return false;
                              const team = teams.find(team => team.id === p.team_id);
                              return team?.organization_id === selectedOrganization.id;
                            });
                            
                            // If assigned to projects but none are in this organization, hide it.
                            // Only allow if it's explicitly assigned to THIS org or has no projects at all (and no conflicting explicit org).
                            if (t.project_ids.length > 0 && !taskInOrg) return false;
                            if (t.project_ids.length === 0 && t.organization_id && t.organization_id !== selectedOrganization.id) return false;
                          }

                          // Filter by Division if selected
                          if (selectedDivision) {
                            if (t.division_id && t.division_id !== selectedDivision.id) return false;
                            const taskInDiv = projects.some(p => {
                              if (!t.project_ids.includes(p.id)) return false;
                              const team = teams.find(team => team.id === p.team_id);
                              return team?.division_id === selectedDivision.id;
                            });
                            if (t.project_ids.length > 0 && !taskInDiv) return false;
                            if (t.project_ids.length === 0 && t.division_id && t.division_id !== selectedDivision.id) return false;
                          }

                          // Filter by Team if selected
                          if (selectedTeam) {
                            const taskInTeam = projects.some(p => t.project_ids.includes(p.id) && p.team_id === selectedTeam.id);
                            if (!taskInTeam) return false;
                          }
                          
                          // Filter by Search Query
                          if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
                            return false;
                          }

                          // Filter by Priority
                          if (filterPriority !== 'all' && t.priority !== filterPriority) return false;

                          // Filter by Status
                          if (filterStatus !== 'all' && t.status !== filterStatus) return false;

                          // Filter by Orphaned
                          if (filterOrphaned && t.project_ids.length > 0) return false;

                          // Filter by Completed
                          if (!showCompleted && t.status === 'completed') return false;

                          // Filter by Assignee
                          if (filterAssigneeId !== null && t.assignee_id !== filterAssigneeId) return false;

                          return true;
                        })
                        .sort((a, b) => {
                          const priorityOrder = { urgent: 4, high: 3, moderate: 2, low: 1 };
                          let valA: any, valB: any;
                          
                          switch (sortField) {
                            case 'title':
                              valA = a.title.toLowerCase();
                              valB = b.title.toLowerCase();
                              break;
                            case 'due_date':
                              valA = a.due_date || '9999-99-99';
                              valB = b.due_date || '9999-99-99';
                              break;
                            case 'priority':
                              valA = priorityOrder[a.priority];
                              valB = priorityOrder[b.priority];
                              break;
                            case 'status':
                              valA = a.status;
                              valB = b.status;
                              break;
                            case 'key_result':
                              valA = (a.key_result || '').toLowerCase();
                              valB = (b.key_result || '').toLowerCase();
                              break;
                            case 'project':
                              const pA = projects.find(p => a.project_ids.includes(p.id))?.name || '';
                              const pB = projects.find(p => b.project_ids.includes(p.id))?.name || '';
                              valA = pA.toLowerCase();
                              valB = pB.toLowerCase();
                              break;
                            case 'team':
                              const projA = projects.find(p => a.project_ids.includes(p.id));
                              const tA = teams.find(t => t.id === projA?.team_id)?.name || '';
                              const projB = projects.find(p => b.project_ids.includes(p.id));
                              const tB = teams.find(t => t.id === projB?.team_id)?.name || '';
                              valA = tA.toLowerCase();
                              valB = tB.toLowerCase();
                              break;
                            case 'organization':
                              const paA = projects.find(p => a.project_ids.includes(p.id));
                              const teA = teams.find(t => t.id === paA?.team_id);
                              const oA = organizations.find(o => o.id === teA?.organization_id)?.name || '';
                              const paB = projects.find(p => b.project_ids.includes(p.id));
                              const teB = teams.find(t => t.id === paB?.team_id);
                              const oB = organizations.find(o => o.id === teB?.organization_id)?.name || '';
                              valA = oA.toLowerCase();
                              valB = oB.toLowerCase();
                              break;
                            default:
                              valA = a.id;
                              valB = b.id;
                          }

                          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
                          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
                          return 0;
                        }).map((task) => {
                          const project = projects.find(p => task.project_ids.includes(p.id));
                          const team = teams.find(t => t.id === project?.team_id);
                          
                          return (
                            <motion.tr 
                              layout
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              key={task.id} 
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors group"
                            >
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                                  className={`transition-colors ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}
                                >
                                  {task.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                </button>
                              </td>
                              <td className="px-6 py-4">
                                <button 
                                  onClick={() => setViewingTaskId(task.id)}
                                  className={`text-sm font-bold text-left hover:text-emerald-600 transition-colors ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}
                                >
                                  {task.title}
                                </button>
                              </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              {task.assignee_id && (
                                <img 
                                  src={users.find(u => u.id === task.assignee_id)?.avatar_url} 
                                  alt={(() => {
                                    const u = users.find(usr => usr.id === task.assignee_id);
                                    return u ? `${u.first_name} ${u.last_name || ''}`.trim() : '';
                                  })()}
                                  className="w-5 h-5 rounded-full ring-1 ring-slate-100"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                                <select
                                  value={task.assignee_id || ''}
                                  onChange={(e) => assignTaskToUser(task.id, e.target.value ? Number(e.target.value) : null)}
                                  className="bg-transparent border-none focus:ring-0 text-xs font-medium text-slate-600 cursor-pointer p-0"
                                >
                                  <option value="">Unassigned</option>
                                  {users.map(u => (
                                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                                  ))}
                                </select>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="text"
                              value={task.key_result || ''}
                              onChange={(e) => updateTaskDetails(task.id, { key_result: e.target.value })}
                              placeholder="Add key result..."
                              className="text-xs text-slate-500 font-medium bg-transparent border-none focus:ring-2 focus:ring-emerald-500/20 rounded-lg px-2 py-1 w-full"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={task.priority}
                              onChange={(e) => updateTaskDetails(task.id, { priority: e.target.value as any })}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500/20 appearance-none text-center ${getPriorityColor(task.priority)}`}
                            >
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <input
                              type="date"
                              value={task.due_date ? task.due_date.split('T')[0] : ''}
                              onChange={(e) => updateTaskDetails(task.id, { due_date: e.target.value })}
                              className="text-xs text-slate-500 font-medium bg-transparent border-none focus:ring-2 focus:ring-emerald-500/20 rounded-lg px-2 py-1 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-bold whitespace-nowrap">
                            {(() => {
                              const project = projects.find(p => task.project_ids.includes(p.id));
                              const team = teams.find(t => t.id === project?.team_id);
                              const orgId = task.organization_id || team?.organization_id || '';
                              
                              return (
                                <select
                                  value={orgId}
                                  onChange={(e) => assignTaskToOrganization(task.id, Number(e.target.value))}
                                  className="bg-transparent border-none focus:ring-2 focus:ring-emerald-500/20 rounded-lg px-2 py-1 cursor-pointer w-full font-bold text-slate-700"
                                >
                                  <option value="" disabled>Unassigned</option>
                                  {organizations.map(org => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-medium whitespace-nowrap">
                            {(() => {
                              const projectForTeam = projects.find(p => task.project_ids.includes(p.id));
                              const currentTeamId = task.team_id || projectForTeam?.team_id || '';
                              const orgId = task.organization_id || teams.find(t => t.id === currentTeamId)?.organization_id || '';
                              
                              return (
                                <select
                                  value={currentTeamId}
                                  onChange={(e) => assignTaskToTeam(task.id, Number(e.target.value))}
                                  className="bg-transparent border-none focus:ring-2 focus:ring-emerald-500/20 rounded-lg px-2 py-1 cursor-pointer w-full font-bold text-slate-700"
                                >
                                  <option value="" disabled>Unassigned</option>
                                  {teams.filter(t => {
                                    if (task.division_id) {
                                      return Number(t.division_id) === Number(task.division_id);
                                    }
                                    if (orgId) {
                                      return Number(t.organization_id) === Number(orgId);
                                    }
                                    return true;
                                  }).map(t => {
                                    const orgName = organizations.find(o => o.id === t.organization_id)?.name || 'Unassigned';
                                    return (
                                      <option key={t.id} value={t.id}>
                                        {t.name} {!orgId ? `(${orgName})` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                            {(() => {
                              const projectForTeam = projects.find(p => task.project_ids.includes(p.id));
                              const currentTeamId = task.team_id || projectForTeam?.team_id || '';
                              const orgId = task.organization_id || teams.find(t => t.id === currentTeamId)?.organization_id || '';

                              return (
                                <select
                                  value={task.project_ids[0] || ''}
                                  onChange={(e) => {
                                    const newPid = Number(e.target.value);
                                    updateTaskDetails(task.id, { project_ids: [newPid] });
                                  }}
                                  className="bg-transparent border-none focus:ring-2 focus:ring-emerald-500/20 rounded-lg px-2 py-1 cursor-pointer w-full"
                                >
                                  <option value="" disabled>Select Project</option>
                                  {projects.filter(p => {
                                    if (currentTeamId) {
                                      return p.team_id === Number(currentTeamId);
                                    }
                                    if (orgId) {
                                      const team = teams.find(t => t.id === p.team_id);
                                      return team?.organization_id === Number(orgId);
                                    }
                                    const team = teams.find(t => t.id === p.team_id);
                                    if (selectedOrganization && team?.organization_id !== selectedOrganization.id) return false;
                                    return selectedTeam ? p.team_id === selectedTeam.id : true;
                                  }).map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setViewingTaskId(task.id)}
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Maximize2 size={16} />
                            </button>
                          </td>
                            </motion.tr>
                          );
                        })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </div>
          ) : currentView === 'project' && selectedProject ? (
            <div className="max-w-5xl mx-auto space-y-8">
              {/* Add Task Form */}
              <form onSubmit={addTask} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="relative group">
                  <input 
                    type="text" 
                    placeholder="What needs to be done?" 
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                    className="w-full text-lg font-medium bg-transparent border-none focus:ring-0 placeholder:text-slate-300"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-emerald-500 transition-colors">
                    <Plus size={20} />
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                    <select 
                      value={newTaskPriority}
                      onChange={(e) => setNewTaskPriority(e.target.value as Task['priority'])}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="low">Low</option>
                      <option value="moderate">Moderate</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assignee</label>
                    <select
                      value={newTaskAssigneeId || ''}
                      onChange={(e) => setNewTaskAssigneeId(e.target.value ? Number(e.target.value) : null)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">Unassigned</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Result</label>
                    <input 
                      type="text"
                      value={newTaskKeyResult}
                      onChange={(e) => setNewTaskKeyResult(e.target.value)}
                      placeholder="Manually populated..."
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-48"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                    <input 
                      type="date"
                      value={newTaskDueDate}
                      onChange={(e) => setNewTaskDueDate(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Section</label>
                    <select 
                      value={newTaskSectionId || ''}
                      onChange={(e) => setNewTaskSectionId(e.target.value ? Number(e.target.value) : null)}
                      className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">No Section</option>
                      {sections.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <button 
                    type="submit"
                    className="ml-auto px-6 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100"
                  >
                    Add Task
                  </button>
                </div>
              </form>

              {/* Section Controls */}
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Sections</h2>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => setShowCompleted(!showCompleted)}
                    className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${showCompleted ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {showCompleted ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                    {showCompleted ? 'Showing Completed' : 'Hiding Completed'}
                  </button>
                  <button 
                    onClick={() => setIsAddingSection(!isAddingSection)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Section
                  </button>
                </div>
              </div>

              {isAddingSection && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
                  <input
                    type="text"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    placeholder="Section Name (e.g. In Progress)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    {SECTION_COLORS.map(c => (
                      <button
                        key={c.name}
                        onClick={() => setNewSectionColor(c.name)}
                        className={`w-6 h-6 rounded-full border-2 ${c.bg} ${newSectionColor === c.name ? 'border-slate-900' : 'border-transparent'}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={addSection} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold">Save Section</button>
                    <button onClick={() => setIsAddingSection(false)} className="text-slate-400 px-4 py-2 text-xs font-bold">Cancel</button>
                  </div>
                </div>
              )}

              {/* Task List Grouped by Sections */}
              <div className="space-y-8">
                {loading ? (
                  <div className="py-20 text-center text-slate-400">Loading tasks...</div>
                ) : (
                  <>
                    {[...allSections.filter(s => Number(s.project_id) === Number(selectedProject.id)), { id: null, name: 'Uncategorized', color: 'slate' }].map((section: any) => {
                      const sectionTasks = tasks.filter(t => {
                        const projectId = Number(selectedProject.id);
                        if (!t.project_ids.map(Number).includes(projectId)) return false;
                        
                        // Filter by Search Query in Project View too
                        if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase()) && !t.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
                          return false;
                        }

                        // Filter by Completed
                        if (!showCompleted && t.status === 'completed') return false;

                        // Filter by Assignee
                        if (filterAssigneeId !== null && t.assignee_id !== filterAssigneeId) return false;

                        const sid = t.section_assignments?.[projectId];
                        return section.id === null ? !sid : sid === section.id;
                      });

                      if (section.id === null && sectionTasks.length === 0) return null;

                      const colorConfig = SECTION_COLORS.find(c => c.name === section.color) || SECTION_COLORS[0];

                      return (
                        <div key={section.id || 'uncategorized'} className="space-y-4">
                          <div className={`flex items-center justify-between px-4 py-2 rounded-xl border ${colorConfig.bg} ${colorConfig.text} ${colorConfig.border}`}>
                            {editingSectionId === section.id ? (
                              <div className="flex-grow flex items-center gap-3">
                                <div className="flex gap-1">
                                  {SECTION_COLORS.map(c => (
                                    <button
                                      key={c.name}
                                      onClick={() => setEditingSectionColor(c.name)}
                                      className={`w-4 h-4 rounded-full ${c.bg} ${editingSectionColor === c.name ? 'ring-2 ring-emerald-500 ring-offset-1' : ''}`}
                                    />
                                  ))}
                                </div>
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingSectionName}
                                  onChange={(e) => setEditingSectionName(e.target.value)}
                                  className="text-xs font-bold uppercase tracking-wider bg-transparent border-b border-white/30 focus:outline-none focus:border-white flex-grow"
                                  onKeyDown={(e) => e.key === 'Enter' && updateSection(section.id, editingSectionName, editingSectionColor)}
                                />
                                <button onClick={() => updateSection(section.id, editingSectionName, editingSectionColor)} className="text-[10px] font-bold">Save</button>
                                <button onClick={() => setEditingSectionId(null)} className="text-[10px] font-bold opacity-60">Cancel</button>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-xs uppercase tracking-wider">{section.name}</span>
                                  <span className="text-[10px] opacity-60 font-medium">({sectionTasks.length})</span>
                                </div>
                                {section.id !== null && (
                                  <div className="flex items-center gap-2 opacity-40 hover:opacity-100 transition-opacity">
                                    <button 
                                      onClick={() => {
                                        setEditingSectionId(section.id);
                                        setEditingSectionName(section.name);
                                        setEditingSectionColor(section.color);
                                      }}
                                      className="hover:text-emerald-600 transition-colors"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button onClick={() => deleteSection(section.id)} className="hover:text-red-500 transition-colors">
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          <div className="space-y-3">
                            <AnimatePresence mode="popLayout">
                              {sectionTasks.map((task) => (
                                <motion.div
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  key={task.id}
                                  className={`group bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-4 hover:shadow-md hover:border-emerald-100 transition-all ${task.status === 'completed' ? 'opacity-60' : ''}`}
                                >
                                  {editingTaskId === task.id ? (
                                    <div className="space-y-4">
                                      <input
                                        autoFocus
                                        type="text"
                                        value={editingTaskTitle}
                                        onChange={(e) => setEditingTaskTitle(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-emerald-500"
                                      />
                                      <div className="flex flex-wrap gap-4">
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Priority</label>
                                          <select 
                                            value={editingTaskPriority}
                                            onChange={(e) => setEditingTaskPriority(e.target.value as Task['priority'])}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                          >
                                            <option value="low">Low</option>
                                            <option value="moderate">Moderate</option>
                                            <option value="high">High</option>
                                            <option value="urgent">Urgent</option>
                                          </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Due Date</label>
                                          <input 
                                            type="date"
                                            value={editingTaskDueDate}
                                            onChange={(e) => setEditingTaskDueDate(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Key Result</label>
                                          <input 
                                            type="text"
                                            value={editingTaskKeyResult}
                                            onChange={(e) => setEditingTaskKeyResult(e.target.value)}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 w-48"
                                          />
                                        </div>
                                        <div className="flex items-center gap-2">
                                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project</label>
                                          {(() => {
                                            const pForOrg = projects.find(proj => task.project_ids.includes(proj.id));
                                            const tForOrg = teams.find(team => team.id === pForOrg?.team_id);
                                            const tOrgId = task.organization_id || tForOrg?.organization_id;
                                            const tTeamId = task.team_id || pForOrg?.team_id;

                                            return (
                                              <select 
                                                multiple
                                                value={editingTaskProjectIds.map(String)}
                                                onChange={(e) => setEditingTaskProjectIds(Array.from(e.target.selectedOptions).map((o: any) => Number(o.value)))}
                                                className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-emerald-500 min-w-32"
                                              >
                                                {projects.filter(p => {
                                                  if (tTeamId) {
                                                    return p.team_id === Number(tTeamId);
                                                  }
                                                  if (tOrgId) {
                                                    const team = teams.find(t => t.id === p.team_id);
                                                    return team?.organization_id === Number(tOrgId);
                                                  }
                                                  return p.team_id === (selectedTeam?.id || p.team_id);
                                                }).map(p => (
                                                  <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                              </select>
                                            );
                                          })()}
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => updateTaskDetails(task.id, { title: editingTaskTitle, priority: editingTaskPriority, due_date: editingTaskDueDate, key_result: editingTaskKeyResult, project_ids: editingTaskProjectIds })} className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold">Update</button>
                                        <button onClick={() => setEditingTaskId(null)} className="text-slate-400 px-4 py-1.5 text-xs font-bold">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="flex items-center gap-4">
                                        <button 
                                          onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                                          className={`transition-colors ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}
                                        >
                                          {task.status === 'completed' ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                                        </button>
                                        
                                        <div className="flex-grow">
                                          <h4 className={`font-bold transition-all ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                                            {task.title}
                                          </h4>
                                          <div className="flex items-center gap-4 mt-1">
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                                              {task.priority}
                                            </span>
                                            {task.due_date && (
                                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                                <Clock size={12} />
                                                {new Date(task.due_date).toLocaleDateString()}
                                              </div>
                                            )}
                                            {task.assignee_id && (
                                              <div className="flex items-center gap-1.5 ml-auto border border-slate-100 bg-slate-50/50 rounded-xl px-2 py-0.5 shrink-0 transition-all">
                                                {(() => {
                                                  const u = users.find(usr => usr.id === task.assignee_id);
                                                  if (!u) return null;
                                                  const fullName = `${u.first_name} ${u.last_name || ''}`.trim();
                                                  return (
                                                    <>
                                                      <img 
                                                        src={u.avatar_url} 
                                                        alt={fullName} 
                                                        className="w-4 h-4 rounded-full ring-1 ring-slate-200"
                                                        referrerPolicy="no-referrer"
                                                      />
                                                      <span className="text-[10px] font-semibold text-slate-500">{fullName}</span>
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <button 
                                            onClick={() => {
                                              setEditingTaskId(task.id);
                                              setEditingTaskTitle(task.title);
                                              setEditingTaskPriority(task.priority);
                                              setEditingTaskDueDate(task.due_date || '');
                                              setEditingTaskKeyResult(task.key_result || '');
                                              setEditingTaskProjectIds(task.project_ids);
                                            }}
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                          <button 
                                            onClick={() => deleteTask(task.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                          <button 
                                            onClick={() => setExpandedTaskId(expandedTaskId === task.id ? null : task.id)}
                                            className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                                          >
                                            {expandedTaskId === task.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                          </button>
                                        </div>
                                      </div>

                                      {/* Expanded Details */}
                                      <AnimatePresence>
                                        {expandedTaskId === task.id && (
                                          <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="overflow-hidden border-t border-slate-100 pt-4 space-y-6"
                                          >
                                            {/* Assignee */}
                                            <div className="space-y-2">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <UserIcon size={12} /> Assignee
                                              </h4>
                                              <div className="pl-4">
                                                <div className="flex items-center gap-2 max-w-xs bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-emerald-500 transition-all">
                                                  {task.assignee_id && (
                                                    <img 
                                                      src={users.find(u => u.id === task.assignee_id)?.avatar_url} 
                                                      alt="Avatar"
                                                      className="w-5 h-5 rounded-full ml-1 shrink-0"
                                                      referrerPolicy="no-referrer"
                                                    />
                                                  )}
                                                  <select 
                                                    value={task.assignee_id || ''}
                                                    onChange={(e) => assignTaskToUser(task.id, e.target.value ? Number(e.target.value) : null)}
                                                    className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 cursor-pointer flex-grow py-1 focus:outline-none"
                                                  >
                                                    <option value="">Unassigned</option>
                                                    {users.map(u => (
                                                      <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                                                    ))}
                                                  </select>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Key Result */}
                                            <div className="space-y-2">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <AlertCircle size={12} /> Key Result
                                              </h4>
                                              <div className="pl-4">
                                                <input
                                                  type="text"
                                                  value={task.key_result || ''}
                                                  onChange={(e) => updateTaskDetails(task.id, { key_result: e.target.value })}
                                                  placeholder="What is the key result for this task?"
                                                  className="w-full text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500 transition-all"
                                                />
                                              </div>
                                            </div>

                                            {/* Projects Management */}
                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <FolderKanban size={12} /> Projects & Sections
                                              </h4>
                                              <div className="space-y-3 pl-4">
                                                {task.project_ids.map(pid => {
                                                  const project = projects.find(p => p.id === pid);
                                                  if (!project) return null;
                                                  const projectSections = allSections.filter(s => Number(s.project_id) === Number(pid));
                                                  const currentSectionId = task.section_assignments?.[pid];
                                                  
                                                  return (
                                                    <div key={pid} className="flex flex-col gap-2 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                      <div className="flex items-center justify-between">
                                                        <div className="flex flex-col">
                                                          <span className="text-xs font-bold text-slate-700">{project.name}</span>
                                                          {(() => {
                                                            const t = teams.find(team => team.id === project.team_id);
                                                            return t ? <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t.name}</span> : null;
                                                          })()}
                                                        </div>
                                                        <button 
                                                          onClick={() => {
                                                            const newProjectIds = task.project_ids.filter(id => id !== pid);
                                                            updateTaskDetails(task.id, { project_ids: newProjectIds });
                                                          }}
                                                          className="text-[10px] font-bold text-red-500 hover:text-red-600"
                                                        >
                                                          Remove
                                                        </button>
                                                      </div>
                                                      <div className="flex items-center gap-2">
                                                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Section:</label>
                                                        <select 
                                                          value={currentSectionId || ''}
                                                          onChange={(e) => {
                                                            const sid = e.target.value ? parseInt(e.target.value) : null;
                                                            updateTaskDetails(task.id, { section_id: sid, current_project_id: pid } as any);
                                                          }}
                                                          className="bg-white border border-slate-200 rounded px-2 py-1 text-[10px] focus:outline-none focus:border-emerald-500 flex-grow"
                                                        >
                                                          <option value="">No Section</option>
                                                          {projectSections.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                          ))}
                                                        </select>
                                                      </div>
                                                    </div>
                                                  );
                                                })}
                                                
                                                {/* Add to another project */}
                                                <div className="flex items-center gap-2 mt-2">
                                                  <Plus size={14} className="text-slate-300" />
                                                  <select 
                                                    value=""
                                                    onChange={(e) => {
                                                      const pid = parseInt(e.target.value);
                                                      if (!task.project_ids.includes(pid)) {
                                                        updateTaskDetails(task.id, { project_ids: [...task.project_ids, pid] });
                                                      }
                                                    }}
                                                    className="text-[10px] bg-transparent border-none focus:ring-0 text-slate-500 font-medium cursor-pointer w-full"
                                                  >
                                                    <option value="" disabled>Add to project...</option>
                                                    {(() => {
                                                      const pForOrg = projects.find(proj => task.project_ids.includes(proj.id));
                                                      const tForOrg = teams.find(team => team.id === pForOrg?.team_id);
                                                      const taskOrgId = task.organization_id || tForOrg?.organization_id || '';
                                                      const taskTeamId = task.team_id || pForOrg?.team_id || '';

                                                      return teams
                                                        .filter(t => {
                                                          if (taskTeamId) {
                                                            return t.id === Number(taskTeamId);
                                                          }
                                                          if (taskOrgId) {
                                                            return t.organization_id === Number(taskOrgId);
                                                          }
                                                          return !selectedOrganization || t.organization_id === selectedOrganization.id;
                                                        })
                                                        .map(team => {
                                                          const teamProjects = projects.filter(p => p.team_id === team.id && !task.project_ids.includes(p.id));
                                                          if (teamProjects.length === 0) return null;
                                                          const orgName = organizations.find(o => o.id === team.organization_id)?.name || 'Unassigned';
                                                          return (
                                                            <optgroup key={team.id} label={`${team.name} ${!taskOrgId ? `(${orgName})` : ''}`}>
                                                              {teamProjects.map(p => (
                                                                <option key={p.id} value={p.id}>{p.name}</option>
                                                              ))}
                                                            </optgroup>
                                                          );
                                                        });
                                                    })()}
                                                  </select>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Subtasks */}
                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <CheckCircle2 size={12} /> Subtasks
                                              </h4>
                                              <div className="space-y-2 pl-4">
                                                {task.subtasks?.map(st => (
                                                  <div key={st.id} className="space-y-1">
                                                    <div className="flex items-center gap-3 group/st">
                                                      <button onClick={() => toggleSubtask(st)} className={st.status === 'completed' ? 'text-emerald-500' : 'text-slate-300'}>
                                                        {st.status === 'completed' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                                      </button>
                                                      {editingSubtaskId === st.id ? (
                                                        <div className="flex-grow flex items-center gap-2">
                                                          <input
                                                            autoFocus
                                                            type="text"
                                                            value={editingSubtaskTitle}
                                                            onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                                            className="text-sm bg-slate-50 border border-slate-200 rounded px-2 py-0.5 focus:outline-none focus:border-emerald-500 flex-grow"
                                                            onKeyDown={(e) => e.key === 'Enter' && updateSubtask(st.id, editingSubtaskTitle)}
                                                          />
                                                          <button onClick={() => updateSubtask(st.id, editingSubtaskTitle)} className="text-[10px] font-bold text-emerald-600">Save</button>
                                                          <button onClick={() => setEditingSubtaskId(null)} className="text-[10px] font-bold text-slate-400">Cancel</button>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <span className={`text-sm flex-grow ${st.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                                                            {st.title}
                                                          </span>
                                                          <div className="flex items-center gap-1 opacity-0 group-hover/st:opacity-100 transition-opacity">
                                                            <button 
                                                              onClick={() => {
                                                                setEditingSubtaskId(st.id);
                                                                setEditingSubtaskTitle(st.title);
                                                              }}
                                                              className="p-1 text-slate-400 hover:text-emerald-600"
                                                            >
                                                              <Edit2 size={12} />
                                                            </button>
                                                            <button 
                                                              onClick={() => deleteSubtask(st.id)}
                                                              className="p-1 text-slate-400 hover:text-red-500"
                                                            >
                                                              <Trash2 size={12} />
                                                            </button>
                                                          </div>
                                                        </>
                                                      )}
                                                    </div>
                                                    
                                                    {/* Subtask Comments */}
                                                    {st.comments && st.comments.length > 0 && (
                                                      <div className="mt-2 space-y-2 pl-6 border-l border-slate-100">
                                                        {st.comments.map(comment => (
                                                          <div key={comment.id} className="group/comment bg-slate-50/50 p-2 rounded-lg relative">
                                                            <p className="text-xs text-slate-600">{comment.content}</p>
                                                            {comment.attachment_url && (
                                                              <a 
                                                                href={comment.attachment_url} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                className="mt-1 flex items-center gap-1 text-[10px] text-emerald-600 hover:underline"
                                                              >
                                                                <Paperclip size={10} />
                                                                {comment.attachment_name || 'Attachment'}
                                                              </a>
                                                            )}
                                                            <div className="flex items-center justify-between mt-1">
                                                              <span className="text-[9px] text-slate-400 font-medium">
                                                                {new Date(comment.created_at).toLocaleString()}
                                                              </span>
                                                              <button 
                                                                onClick={() => deleteComment(comment.id)}
                                                                className="opacity-0 group-hover/comment:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity"
                                                              >
                                                                <Trash2 size={10} />
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ))}
                                                      </div>
                                                    )}

                                                    {/* Add Subtask Comment */}
                                                    <div className="mt-2 pl-6">
                                                      <div className="flex flex-col gap-2 bg-slate-50/30 p-2 rounded-lg border border-dashed border-slate-200">
                                                        <textarea 
                                                          placeholder="Add a progress log..." 
                                                          value={newCommentContent}
                                                          onChange={(e) => setNewCommentContent(e.target.value)}
                                                          className="text-xs bg-transparent border-none focus:ring-0 placeholder:text-slate-300 resize-none h-12"
                                                        />
                                                        <div className="flex items-center gap-2">
                                                          <input 
                                                            type="text" 
                                                            placeholder="Attach URL (optional)..." 
                                                            value={newCommentAttachmentUrl}
                                                            onChange={(e) => setNewCommentAttachmentUrl(e.target.value)}
                                                            className="flex-grow text-[10px] bg-white border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-emerald-500"
                                                          />
                                                          <button 
                                                            onClick={() => addComment(undefined, st.id)}
                                                            className="bg-emerald-600 text-white px-3 py-1 rounded text-[10px] font-bold"
                                                          >
                                                            Log
                                                          </button>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                ))}
                                                <div className="flex items-center gap-3">
                                                  <Plus size={16} className="text-slate-300" />
                                                  <input 
                                                    type="text" 
                                                    placeholder="Add subtask..." 
                                                    value={newSubtaskTitle}
                                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                                    className="text-sm bg-transparent border-none focus:ring-0 placeholder:text-slate-300 flex-grow"
                                                    onKeyDown={(e) => e.key === 'Enter' && addSubtask(task.id)}
                                                  />
                                                </div>
                                              </div>
                                            </div>

                                            {/* Attachments */}
                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Paperclip size={12} /> Attachments
                                              </h4>
                                              <div className="space-y-2 pl-4">
                                                {task.attachments?.map(at => (
                                                  <div key={at.id} className="group/at flex items-center gap-2">
                                                    <a 
                                                      href={at.url} 
                                                      target="_blank" 
                                                      rel="noopener noreferrer"
                                                      className="flex items-center gap-2 text-sm text-emerald-600 hover:underline"
                                                    >
                                                      <FolderKanban size={14} />
                                                      {at.name}
                                                    </a>
                                                    <button 
                                                      onClick={() => deleteAttachment(at.id)}
                                                      className="opacity-0 group-hover/at:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity"
                                                    >
                                                      <Trash2 size={14} />
                                                    </button>
                                                  </div>
                                                ))}
                                                <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                  <input 
                                                    type="text" 
                                                    placeholder="File name..." 
                                                    value={newAttachmentName}
                                                    onChange={(e) => setNewAttachmentName(e.target.value)}
                                                    className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                                                  />
                                                  <div className="flex gap-2">
                                                    <input 
                                                      type="text" 
                                                      placeholder="URL..." 
                                                      value={newAttachmentUrl}
                                                      onChange={(e) => setNewAttachmentUrl(e.target.value)}
                                                      className="flex-grow text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                                                    />
                                                    <button 
                                                      onClick={() => addAttachment(task.id)}
                                                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold"
                                                    >
                                                      Add
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Task Comments */}
                                            <div className="space-y-3">
                                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                                <Terminal size={12} /> Progress Logs
                                              </h4>
                                              <div className="space-y-3 pl-4">
                                                {task.comments?.map(comment => (
                                                  <div key={comment.id} className="group/comment bg-slate-50 p-3 rounded-xl border border-slate-100 relative">
                                                    <p className="text-sm text-slate-700 leading-relaxed">{comment.content}</p>
                                                    {comment.attachment_url && (
                                                      <a 
                                                        href={comment.attachment_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-emerald-600 hover:bg-emerald-50 transition-colors"
                                                      >
                                                        <Paperclip size={12} />
                                                        {comment.attachment_name || 'View Attachment'}
                                                      </a>
                                                    )}
                                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100">
                                                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                                        {new Date(comment.created_at).toLocaleString()}
                                                      </span>
                                                      <button 
                                                        onClick={() => deleteComment(comment.id)}
                                                        className="opacity-0 group-hover/comment:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </div>
                                                  </div>
                                                ))}

                                                <div className="bg-white border border-dashed border-slate-200 rounded-2xl p-4 space-y-3">
                                                  <textarea 
                                                    placeholder="Log your progress on this task..." 
                                                    value={newCommentContent}
                                                    onChange={(e) => setNewCommentContent(e.target.value)}
                                                    className="w-full text-sm bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 resize-none h-24"
                                                  />
                                                  <div className="flex gap-3">
                                                    <div className="flex-grow grid grid-cols-2 gap-2">
                                                      <input 
                                                        type="text" 
                                                        placeholder="Attachment Name (e.g. Screenshot)" 
                                                        value={newCommentAttachmentName}
                                                        onChange={(e) => setNewCommentAttachmentName(e.target.value)}
                                                        className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                                                      />
                                                      <input 
                                                        type="text" 
                                                        placeholder="Attachment URL" 
                                                        value={newCommentAttachmentUrl}
                                                        onChange={(e) => setNewCommentAttachmentUrl(e.target.value)}
                                                        className="text-xs bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-500"
                                                      />
                                                    </div>
                                                    <button 
                                                      onClick={() => addComment(task.id)}
                                                      className="px-6 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
                                                    >
                                                      Add Log
                                                    </button>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </>
                                  )}
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </div>
          ) : currentView === 'project' && selectedTeam ? (
            <div className="max-w-5xl mx-auto space-y-8">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">{selectedTeam.name} Projects</h2>
                  <p className="text-slate-500 font-medium">Select a project from the rows below to view its tasks and sections</p>
                </div>
                <button 
                  onClick={() => setIsAddingProject(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={20} />
                  New Project
                </button>
              </div>

              <div className="space-y-4">
                {projects.filter(p => p.team_id === selectedTeam.id).map(project => {
                  const projectTasks = tasks.filter(t => t.project_ids?.includes(project.id));
                  const completedTasksCount = projectTasks.filter(t => t.status === 'completed').length;
                  const percentComplete = projectTasks.length > 0 ? Math.round((completedTasksCount / projectTasks.length) * 100) : 0;

                  return (
                    <div 
                      key={project.id}
                      onClick={() => {
                        setSelectedProject(project);
                        setCurrentView('project');
                      }}
                      className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:shadow-lg hover:shadow-slate-100 transition-all group animate-in fade-in slide-in-from-top-1"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-all">
                          <FolderKanban size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                            {project.name}
                          </h3>
                          {project.description ? (
                            <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                              {project.description}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic line-clamp-1 mt-0.5">
                              No description provided.
                            </p>
                          )}
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                            {projectTasks.length} {projectTasks.length === 1 ? 'Task' : 'Tasks'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end sm:self-center shrink-0">
                        {projectTasks.length > 0 && (
                          <div className="hidden md:flex flex-col items-end w-32 gap-1">
                            <div className="flex justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Progress</span>
                              <span className="text-emerald-600">{percentComplete}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}

                {projects.filter(p => p.team_id === selectedTeam.id).length === 0 && (
                  <div className="py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                      <FolderKanban size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">No projects in this team</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6">Create a project to start tracking your tasks.</p>
                    <button 
                      onClick={() => setIsAddingProject(true)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 rounded-xl font-bold transition-all text-xs"
                    >
                      <Plus size={16} />
                      Create Project
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : currentView === 'project' && selectedDivision ? (
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-250">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-purple-100 text-purple-700 uppercase tracking-widest flex items-center gap-1">
                      <GitBranch size={10} /> Division
                    </span>
                    <span className="text-slate-400 font-bold text-xs">{selectedOrganization?.name}</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 mt-1">{selectedDivision.name} Teams</h2>
                  <p className="text-slate-500 font-medium">Viewing all teams associated with this division</p>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { setIsAddingTeam(true); setSelectedOrganization(selectedOrganization); setSelectedDivision(selectedDivision); }}
                    className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 duration-200"
                  >
                    <Plus size={18} />
                    New Team
                  </button>
                </div>
              </div>

              {/* Teams in Division */}
              <div className="space-y-4">
                {teams.filter(t => t.division_id === selectedDivision.id).map(team => {
                  const teamProjects = projects.filter(p => p.team_id === team.id);
                  const teamProjectIds = teamProjects.map(p => p.id);
                  const teamTasks = tasks.filter(t => t.project_ids?.some(pid => teamProjectIds.includes(pid)));
                  const completedTasksCount = teamTasks.filter(t => t.status === 'completed').length;
                  const percentComplete = teamTasks.length > 0 ? Math.round((completedTasksCount / teamTasks.length) * 100) : 0;

                  return (
                    <div 
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team);
                        setSelectedProject(null);
                        setExpandedNodes(prev => ({ ...prev, [`team-${team.id}`]: true, [`div-${selectedDivision.id}`]: true, [`org-${selectedOrganization?.id}`]: true }));
                      }}
                      className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:shadow-lg hover:shadow-slate-100 transition-all group animate-in fade-in slide-in-from-top-1"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all">
                          <Users size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                            {team.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 mt-0.5">
                            <span>{teamProjects.length} {teamProjects.length === 1 ? 'Project' : 'Projects'}</span>
                            <span className="text-slate-300">•</span>
                            <span>{teamTasks.length} {teamTasks.length === 1 ? 'Task' : 'Tasks'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end sm:self-center shrink-0">
                        {teamTasks.length > 0 && (
                          <div className="hidden md:flex flex-col items-end w-32 gap-1">
                            <div className="flex justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Progress</span>
                              <span className="text-emerald-600">{percentComplete}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-550" 
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}

                {teams.filter(t => t.division_id === selectedDivision.id).length === 0 && (
                  <div className="py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                      <Users size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">No teams in this division</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6 font-medium">Create a team inside this division to start orchestrating projects.</p>
                    <button 
                      onClick={() => { setIsAddingTeam(true); setSelectedOrganization(selectedOrganization); setSelectedDivision(selectedDivision); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 rounded-xl font-bold transition-all text-xs"
                    >
                      <Plus size={16} />
                      Create Team
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : currentView === 'project' && selectedOrganization ? (
            <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in duration-250">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase tracking-widest">Organization</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900 mt-1">{selectedOrganization.name} Profile</h2>
                  <p className="text-slate-500 font-medium font-sans">Manage divisions and functional teams at the core cluster level</p>
                </div>
                <div className="flex gap-2.5">
                  <button 
                    onClick={() => { setIsAddingDivision(true); setSelectedOrganization(selectedOrganization); }}
                    className="flex items-center gap-2 px-5 py-3 border border-purple-200 text-purple-700 bg-purple-50/55 hover:bg-purple-100 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
                  >
                    <GitBranch size={16} />
                    New Division
                  </button>
                  <button 
                    onClick={() => { setIsAddingTeam(true); setSelectedOrganization(selectedOrganization); setSelectedDivision(null); }}
                    className="flex items-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95 duration-200"
                  >
                    <Plus size={18} />
                    New Team
                  </button>
                </div>
              </div>

              {/* Divisions Cards Section (if exists) */}
              {divisions.filter(d => d.organization_id === selectedOrganization.id).length > 0 && (
                <div className="space-y-4 animate-in fade-in duration-300">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <GitBranch size={14} className="text-purple-400" /> Divisions
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {divisions.filter(d => d.organization_id === selectedOrganization.id).map(div => {
                      const divTeamsCount = teams.filter(t => t.division_id === div.id).length;
                      return (
                        <div 
                          key={div.id}
                          onClick={() => {
                            setSelectedDivision(div);
                            setSelectedTeam(null);
                            setSelectedProject(null);
                            setExpandedNodes(prev => ({ ...prev, [`div-${div.id}`]: true, [`org-${selectedOrganization.id}`]: true }));
                          }}
                          className="bg-white border border-slate-200 hover:border-purple-500/50 rounded-3xl p-5 cursor-pointer hover:shadow-lg transition-all group relative overflow-hidden"
                        >
                          <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50/50 rounded-full -mr-10 -mt-10 group-hover:scale-150 transition-transform" />
                          <div className="relative z-10 space-y-4">
                            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-all">
                              <GitBranch size={20} />
                            </div>
                            <div>
                              <h4 className="font-black text-slate-800 text-base">{div.name}</h4>
                              <p className="text-xs text-slate-400 font-semibold mt-1 uppercase tracking-wider">{divTeamsCount} {divTeamsCount === 1 ? 'Team' : 'Teams'}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped or general Teams list */}
              <div className="space-y-4 pt-4">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <Users size={14} className="text-blue-400" />
                  {divisions.filter(d => d.organization_id === selectedOrganization.id).length > 0 ? 'Teams without Division' : 'Teams'}
                </h3>
                
                {teams.filter(t => t.organization_id === selectedOrganization.id && !t.division_id).map(team => {
                  const teamProjects = projects.filter(p => p.team_id === team.id);
                  const teamProjectIds = teamProjects.map(p => p.id);
                  const teamTasks = tasks.filter(t => t.project_ids?.some(pid => teamProjectIds.includes(pid)));
                  const completedTasksCount = teamTasks.filter(t => t.status === 'completed').length;
                  const percentComplete = teamTasks.length > 0 ? Math.round((completedTasksCount / teamTasks.length) * 100) : 0;

                  return (
                    <div 
                      key={team.id}
                      onClick={() => {
                        setSelectedTeam(team);
                        setSelectedProject(null);
                        setSelectedDivision(null);
                        setExpandedNodes(prev => ({ ...prev, [`team-${team.id}`]: true, [`org-${selectedOrganization.id}`]: true }));
                      }}
                      className="bg-white border border-slate-200 hover:border-emerald-500/50 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:shadow-lg hover:shadow-slate-100 transition-all group animate-in fade-in slide-in-from-top-1"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-blue-500 group-hover:text-white transition-all">
                          <Users size={22} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-lg font-black text-slate-800 group-hover:text-emerald-700 transition-colors truncate">
                            {team.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-2 mt-0.5">
                            <span>{teamProjects.length} {teamProjects.length === 1 ? 'Project' : 'Projects'}</span>
                            <span className="text-slate-300">•</span>
                            <span>{teamTasks.length} {teamTasks.length === 1 ? 'Task' : 'Tasks'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 self-end sm:self-center shrink-0">
                        {teamTasks.length > 0 && (
                          <div className="hidden md:flex flex-col items-end w-32 gap-1">
                            <div className="flex justify-between w-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <span>Progress</span>
                              <span className="text-emerald-600">{percentComplete}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-550" 
                                style={{ width: `${percentComplete}%` }}
                              />
                            </div>
                          </div>
                        )}
                        <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
                      </div>
                    </div>
                  );
                })}

                {teams.filter(t => t.organization_id === selectedOrganization.id && !t.division_id).length === 0 && (
                  <div className="py-20 text-center bg-slate-50/50 rounded-3xl border-2 border-dashed border-slate-200 animate-in fade-in">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xs">
                      <Users size={32} className="text-slate-300" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-800 mb-1">No independent teams</h3>
                    <p className="text-slate-500 text-sm max-w-xs mx-auto mb-6 font-medium">Create a team to start structuring your organization's projects.</p>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsAddingTeam(true); setSelectedOrganization(selectedOrganization); setSelectedDivision(null); }}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-600 text-slate-600 rounded-xl font-bold transition-all text-xs"
                    >
                      <Plus size={16} />
                      Create Team
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : currentView === 'users' ? (
            <div className="max-w-5xl mx-auto space-y-8 py-12">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">User Management</h2>
                  <p className="text-slate-500 font-medium mt-1">Manage human operators and Digital Intelligences (DI)</p>
                </div>
                <button 
                  onClick={() => setIsAddingUser(true)}
                  className="flex items-center gap-2 px-8 py-4 bg-emerald-600 text-white rounded-[24px] font-bold shadow-xl shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-105 active:scale-95"
                >
                  <Plus size={20} />
                  Add User
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {users.map(user => (
                  <div key={user.id} className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group flex flex-col justify-between min-h-[300px]">
                    <div>
                      {user.is_di ? (
                        <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 text-[10px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-widest">
                          Digital Intelligence
                        </div>
                      ) : null}
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-3xl overflow-hidden shadow-sm ring-2 ring-slate-50 group-hover:ring-emerald-200 transition-all flex-shrink-0">
                          <img 
                            src={user.avatar_url} 
                            alt={`${user.first_name} ${user.last_name || ''}`} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                        </div>
                        <div className="flex-grow pt-1 min-w-0">
                          <h3 className="text-xl font-black text-slate-900 truncate">
                            {user.first_name} {user.last_name || ''}
                          </h3>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user.user_type}</p>
                        </div>
                      </div>
                      
                      <div className="mt-8 space-y-3 pt-6 border-t border-slate-50">
                        <div className="flex items-center gap-3 text-slate-500">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <Mail size={14} />
                          </div>
                          <span className="text-sm font-medium truncate" title={user.email}>{user.email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                          <div className="w-8 h-8 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 flex-shrink-0">
                            <Phone size={14} />
                          </div>
                          <span className="text-sm font-medium truncate">{user.phone || 'No phone set'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-50 flex items-center justify-end gap-2">
                      <button 
                        onClick={() => {
                          setEditingUser(user);
                          setEditingUserFirstName(user.first_name);
                          setEditingUserLastName(user.last_name || '');
                          setEditingUserEmail(user.email);
                          setEditingUserPhone(user.phone || '');
                          setEditingUserIsDI(!!user.is_di);
                          setEditingUserType(user.user_type);
                        }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => deleteUser(user.id)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-12 py-12">
              <div className="space-y-6">
                <h2 className="text-6xl font-black tracking-tighter text-slate-900 leading-[0.9]">
                  Roots: Local Task Mastery
                </h2>
                <p className="text-xl text-slate-500 font-medium leading-relaxed max-w-3xl">
                  Audrey's powerhouse task manager, engineered from the ground up for zero-latency operations. 
                  Hosted right at <code className="bg-slate-100 px-2 py-1 rounded text-emerald-600 font-mono text-lg">http://localhost:3000</code> with no login friction, 
                  Roots gives full admin control over teams, projects, tasks, subtasks, sections, and attachments. 
                  Audrey can create, read, update, and delete autonomously. It's the backbone for her task orchestration, 
                  optimized to cut through noise and deliver results.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* API Documentation Modal */}
      <AnimatePresence>
        {viewingTaskId && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-8"
            onClick={(e) => e.target === e.currentTarget && setViewingTaskId(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-4xl max-h-full overflow-hidden flex flex-col shadow-2xl"
            >
              {(() => {
                const task = tasks.find(t => t.id === viewingTaskId);
                if (!task) return null;

                const project = projects.find(p => task.project_ids.includes(p.id));
                const team = teams.find(t => t.id === project?.team_id);

                return (
                  <>
                    <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                      <div className="flex items-center gap-6 flex-grow">
                        <button 
                          onClick={() => updateTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                          className={`transition-colors ${task.status === 'completed' ? 'text-emerald-500' : 'text-slate-300 hover:text-emerald-500'}`}
                        >
                          {task.status === 'completed' ? <CheckCircle2 size={32} /> : <Circle size={32} />}
                        </button>
                        <div className="flex-grow">
                          {editingTaskId === task.id ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingTaskTitle}
                              onChange={(e) => setEditingTaskTitle(e.target.value)}
                              onBlur={() => updateTaskDetails(task.id, { title: editingTaskTitle })}
                              className="text-2xl font-black tracking-tight text-slate-900 bg-transparent border-none focus:ring-0 w-full"
                            />
                          ) : (
                            <h2 
                              onClick={() => {
                                setEditingTaskId(task.id);
                                setEditingTaskTitle(task.title);
                                setEditingTaskPriority(task.priority);
                                setEditingTaskDueDate(task.due_date || '');
                                setEditingTaskKeyResult(task.key_result || '');
                                setEditingTaskProjectIds(task.project_ids);
                              }}
                              className={`text-2xl font-black tracking-tight cursor-pointer hover:text-emerald-600 transition-colors ${task.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-900'}`}
                            >
                              {task.title}
                            </h2>
                          )}
                          <div className="flex items-center gap-4 mt-2">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                              {task.priority}
                            </span>
                            {team && <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">{team.name}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            if (confirm('Delete this task?')) {
                              deleteTask(task.id);
                              setViewingTaskId(null);
                            }
                          }}
                          className="p-3 hover:bg-red-50 rounded-2xl transition-colors text-slate-400 hover:text-red-500"
                        >
                          <Trash2 size={24} />
                        </button>
                        <button 
                          onClick={() => setViewingTaskId(null)}
                          className="p-3 hover:bg-white rounded-2xl transition-colors text-slate-400 hover:text-emerald-600 shadow-sm"
                        >
                          <X size={24} />
                        </button>
                      </div>
                    </div>

                    <div className="flex-grow overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-3 gap-12">
                      <div className="md:col-span-2 space-y-10">
                        {/* Subtasks */}
                        <section className="space-y-4">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <CheckCircle2 size={12} /> Subtasks Progress
                          </h3>
                          <div className="space-y-4 pl-4">
                            {task.subtasks?.map(st => (
                              <div key={st.id} className="space-y-2">
                                <div className="flex items-center gap-3 group/st">
                                  <button onClick={() => toggleSubtask(st)} className={st.status === 'completed' ? 'text-emerald-500' : 'text-slate-300'}>
                                    {st.status === 'completed' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                                  </button>
                                  <span className={`text-sm font-medium ${st.status === 'completed' ? 'line-through text-slate-400' : 'text-slate-700'}`}>{st.title}</span>
                                  <button onClick={() => deleteSubtask(st.id)} className="opacity-0 group-hover/st:opacity-100 p-1 text-slate-300 hover:text-red-500 transition-opacity">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                {/* Subtask logs would go here too if needed */}
                              </div>
                            ))}
                            <div className="flex items-center gap-3 bg-slate-50 rounded-2xl p-3 border border-dashed border-slate-200">
                              <Plus size={18} className="text-slate-300" />
                              <input 
                                type="text" 
                                placeholder="Add a checkpoint..." 
                                value={newSubtaskTitle}
                                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                className="text-sm bg-transparent border-none focus:ring-0 placeholder:text-slate-300 flex-grow"
                                onKeyDown={(e) => e.key === 'Enter' && addSubtask(task.id)}
                              />
                            </div>
                          </div>
                        </section>

                        {/* Description / Content placeholder */}
                        <section className="space-y-4">
                          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <Terminal size={12} /> Activity Logs
                          </h3>
                          <div className="space-y-4 pl-4">
                            {task.comments?.map(comment => (
                              <div key={comment.id} className="bg-slate-50 rounded-2xl p-4 relative group">
                                <p className="text-sm text-slate-600 leading-relaxed">{comment.content}</p>
                                <div className="mt-2 flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{new Date(comment.created_at).toLocaleString()}</span>
                                  <button onClick={() => deleteComment(comment.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-opacity">
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))}
                            <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm space-y-4 focus-within:border-emerald-500 transition-colors">
                              <textarea 
                                placeholder="Write a progress log..." 
                                value={newCommentContent}
                                onChange={(e) => setNewCommentContent(e.target.value)}
                                className="w-full text-sm bg-transparent border-none focus:ring-0 placeholder:text-slate-300 resize-none h-24"
                              />
                              <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                <div className="flex items-center gap-2">
                                  <Paperclip size={14} className="text-slate-300" />
                                  <input 
                                    type="text" 
                                    placeholder="Attachment URL..." 
                                    value={newCommentAttachmentUrl}
                                    onChange={(e) => setNewCommentAttachmentUrl(e.target.value)}
                                    className="text-[10px] bg-slate-50 border-none rounded-lg px-2 py-1 focus:ring-1 focus:ring-emerald-500 w-32"
                                  />
                                </div>
                                <button 
                                  onClick={() => addComment(task.id)}
                                  disabled={!newCommentContent.trim()}
                                  className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-100"
                                >
                                  Log Progress
                                </button>
                              </div>
                            </div>
                          </div>
                        </section>
                      </div>

                      <div className="space-y-10 border-l border-slate-100 pl-8">
                        {/* Meta Info */}
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignee</h4>
                            <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-1.5 focus-within:border-emerald-500 transition-colors">
                              {task.assignee_id && (
                                <img 
                                  src={users.find(u => u.id === task.assignee_id)?.avatar_url} 
                                  alt={(() => {
                                    const u = users.find(usr => usr.id === task.assignee_id);
                                    return u ? `${u.first_name} ${u.last_name || ''}`.trim() : '';
                                  })()}
                                  className="w-6 h-6 rounded-full ml-1"
                                  referrerPolicy="no-referrer"
                                />
                              )}
                              <select 
                                value={task.assignee_id || ''}
                                onChange={(e) => assignTaskToUser(task.id, e.target.value ? Number(e.target.value) : null)}
                                className="bg-transparent border-none focus:ring-0 text-xs font-bold text-slate-700 cursor-pointer flex-grow py-1.5"
                              >
                                <option value="">Unassigned</option>
                                {users.map(u => (
                                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name || ''}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Priority</h4>
                            <select 
                              value={task.priority}
                              onChange={(e) => updateTaskDetails(task.id, { priority: e.target.value as any })}
                              className={`w-full text-xs font-bold p-3 rounded-xl border appearance-none transition-all ${getPriorityColor(task.priority)}`}
                            >
                              <option value="low">Low</option>
                              <option value="moderate">Moderate</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Due Date</h4>
                            <input 
                              type="date"
                              value={task.due_date ? task.due_date.split('T')[0] : ''}
                              onChange={(e) => updateTaskDetails(task.id, { due_date: e.target.value })}
                              className="w-full text-xs font-bold p-3 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-emerald-500"
                            />
                          </div>

                          <div className="space-y-2">
                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Assignments</h4>
                            <div className="space-y-3">
                              {task.project_ids.map(pid => {
                                const p = projects.find(proj => proj.id === pid);
                                if (!p) return null;
                                const t = teams.find(team => team.id === p.team_id);
                                return (
                                  <div key={pid} className="flex flex-col gap-2 bg-emerald-50 p-3 rounded-xl border border-emerald-100 group/assign">
                                    <div className="flex items-center justify-between">
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                          <FolderKanban size={10} className="text-emerald-500" />
                                          <span className="text-xs font-bold text-emerald-700">{p.name}</span>
                                        </div>
                                        {t && (
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <Users size={10} className="text-emerald-400" />
                                            <span className="text-[9px] font-bold text-emerald-600/50 uppercase tracking-widest">{t.name}</span>
                                          </div>
                                        )}
                                      </div>
                                      <button 
                                        onClick={() => updateTaskDetails(task.id, { project_ids: task.project_ids.filter(id => id !== pid) })}
                                        className="text-emerald-400 hover:text-red-500 transition-colors"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <label className="text-[9px] font-bold text-emerald-600/40 uppercase tracking-wider">Section:</label>
                                      <select 
                                        value={task.section_assignments?.[pid] || ''}
                                        onChange={(e) => {
                                          const sid = e.target.value ? parseInt(e.target.value) : null;
                                          updateTaskDetails(task.id, { section_id: sid, current_project_id: pid } as any);
                                        }}
                                        className="bg-white border border-emerald-100 rounded px-2 py-1 text-[10px] text-emerald-700 focus:outline-none focus:border-emerald-500 flex-grow"
                                      >
                                        <option value="">No Section</option>
                                        {allSections.filter(s => Number(s.project_id) === Number(pid)).map(s => (
                                          <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                );
                              })}
                              
                              {task.project_ids.length === 0 && (
                                <div className="p-4 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl text-center space-y-2">
                                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
                                    <AlertTriangle size={14} className="text-amber-600" />
                                  </div>
                                  <div>
                                    <h5 className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Unassigned Task</h5>
                                    <p className="text-[9px] text-amber-600/70 font-medium">This task needs a home. Assign it to a team and project below.</p>
                                  </div>
                                </div>
                              )}

                              <div className="p-1 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                                {(() => {
                                  const projectForOrg = projects.find(p => task.project_ids.includes(p.id));
                                  const teamForOrg = teams.find(t => t.id === projectForOrg?.team_id);
                                  const taskOrgId = task.organization_id || teamForOrg?.organization_id || '';
                                  const taskDivId = task.division_id || teamForOrg?.division_id || '';

                                  const projectForTeam = projects.find(p => task.project_ids.includes(p.id));
                                  const taskTeamId = task.team_id || projectForTeam?.team_id || '';

                                  return (
                                    <>
                                      <div className="space-y-1">
                                        <div className="px-3 pt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign to Organization</div>
                                        <select 
                                          value={taskOrgId}
                                          onChange={(e) => assignTaskToOrganization(task.id, Number(e.target.value))}
                                          className="w-full text-xs font-bold px-3 py-2 bg-transparent border-none focus:ring-0 text-slate-600 cursor-pointer"
                                        >
                                          <option value="">Select Organization...</option>
                                          {organizations.map(org => (
                                            <option key={org.id} value={org.id}>{org.name}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="space-y-1 border-t border-slate-200/50 pt-1">
                                        <div className="px-3 pt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign to Division (Optional)</div>
                                        <select 
                                          value={taskDivId || ''}
                                          onChange={(e) => assignTaskToDivision(task.id, e.target.value ? Number(e.target.value) : null)}
                                          className="w-full text-xs font-bold px-3 py-2 bg-transparent border-none focus:ring-0 text-slate-600 cursor-pointer"
                                        >
                                          <option value="">No Division</option>
                                          {divisions.filter(d => !taskOrgId || d.organization_id === Number(taskOrgId)).map(div => (
                                            <option key={div.id} value={div.id}>{div.name}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div className="space-y-1 border-t border-slate-200/50 pt-1">
                                        <div className="px-3 pt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign to Team</div>
                                        <select 
                                          value={taskTeamId}
                                          onChange={(e) => assignTaskToTeam(task.id, Number(e.target.value))}
                                          className="w-full text-xs font-bold px-3 py-2 bg-transparent border-none focus:ring-0 text-slate-600 cursor-pointer"
                                        >
                                          <option value="" disabled>Select Team...</option>
                                          {teams.filter(t => {
                                            if (taskDivId) {
                                              return Number(t.division_id) === Number(taskDivId);
                                            }
                                            if (taskOrgId) {
                                              return Number(t.organization_id) === Number(taskOrgId);
                                            }
                                            return true;
                                          }).map(t => {
                                            const orgName = organizations.find(o => o.id === t.organization_id)?.name || 'Unassigned';
                                            return (
                                              <option key={t.id} value={t.id}>
                                                {t.name} {!taskOrgId ? `(${orgName})` : ''}
                                              </option>
                                            );
                                          })}
                                        </select>
                                      </div>

                                      <div className="space-y-1 border-t border-slate-200/50 pt-1">
                                        <div className="px-3 pt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Quick Project Assignment</div>
                                        <select 
                                          value=""
                                          onChange={(e) => {
                                            const pid = Number(e.target.value);
                                            if (!task.project_ids.includes(pid)) {
                                              updateTaskDetails(task.id, { project_ids: [...task.project_ids, pid] });
                                            }
                                          }}
                                          className="w-full text-xs font-bold px-3 py-2 bg-transparent border-none focus:ring-0 text-slate-600 cursor-pointer"
                                        >
                                          <option value="" disabled>Select Team & Project...</option>
                                          {teams
                                            .filter(t => {
                                              if (taskDivId) {
                                                return Number(t.division_id) === Number(taskDivId);
                                              }
                                              if (taskTeamId) {
                                                return t.id === Number(taskTeamId);
                                              }
                                              if (taskOrgId) {
                                                return t.organization_id === Number(taskOrgId);
                                              }
                                              return !selectedOrganization || t.organization_id === selectedOrganization.id;
                                            })
                                            .map(team => {
                                              const teamProjects = projects.filter(p => p.team_id === team.id);
                                              const orgName = organizations.find(o => o.id === team.organization_id)?.name || 'Unassigned';
                                              return (
                                                <optgroup key={team.id} label={`${team.name} Team ${!taskOrgId ? `(${orgName})` : ''}`}>
                                                  {teamProjects.length > 0 ? (
                                                    teamProjects.map(p => (
                                                      <option key={p.id} value={p.id}>{p.name}</option>
                                                    ))
                                                  ) : (
                                                    <option value="" disabled>No projects in this team</option>
                                                  )}
                                                </optgroup>
                                              );
                                            })}
                                        </select>
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="pt-8 border-t border-slate-100">
                          <button 
                            onClick={() => {
                              setCurrentView('project');
                              setSelectedProject(project || null);
                              setSelectedTeam(team || null);
                              setExpandedTaskId(task.id);
                              setViewingTaskId(null);
                            }}
                            className="w-full flex items-center justify-center gap-2 p-4 bg-slate-900 text-white rounded-2xl text-sm font-bold shadow-xl shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                          >
                            <FolderKanban size={18} />
                            Go to Project View
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Documentation Modal */}
      <AnimatePresence>
        {showApiDocs && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-8"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[32px] w-full max-w-4xl max-h-full overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-emerald-50/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
                    <Terminal className="text-white" size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-emerald-950">API Documentation</h2>
                    <p className="text-sm text-emerald-600 font-medium">Roots Task Management API v1.0</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowApiDocs(false)}
                  className="p-3 hover:bg-white rounded-2xl transition-colors text-slate-400 hover:text-emerald-600 shadow-sm"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-grow overflow-y-auto p-8 space-y-10">
                <section className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    Base URL
                  </h3>
                  <div className="bg-slate-900 rounded-2xl p-4 font-mono text-sm text-emerald-400 border border-slate-800 shadow-inner">
                    https://ais-dev-zszfeqfty5oaoaoprvyc2n-448152886749.us-east1.run.app/api
                  </div>
                </section>

                <section className="space-y-6">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                    Endpoints
                  </h3>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {[
                      { method: 'GET', path: '/organizations', desc: 'Fetch all organizations' },
                      { method: 'POST', path: '/organizations', desc: 'Create a new organization' },
                      { method: 'PATCH', path: '/organizations/:id', desc: 'Update organization name' },
                      { method: 'DELETE', path: '/organizations/:id', desc: 'Delete an organization' },
                      { method: 'GET', path: '/teams', desc: 'Fetch all teams' },
                      { method: 'POST', path: '/teams', desc: 'Create a new team' },
                      { method: 'PATCH', path: '/teams/:id', desc: 'Update team name' },
                      { method: 'DELETE', path: '/teams/:id', desc: 'Delete a team' },
                      { method: 'GET', path: '/projects', desc: 'Fetch all projects' },
                      { method: 'POST', path: '/projects', desc: 'Create a new project' },
                      { method: 'PATCH', path: '/projects/:id', desc: 'Update project details' },
                      { method: 'DELETE', path: '/projects/:id', desc: 'Delete a project' },
                      { method: 'GET', path: '/tasks', desc: 'Fetch all tasks' },
                      { method: 'POST', path: '/tasks', desc: 'Create a new task' },
                      { method: 'PATCH', path: '/tasks/:id', desc: 'Update task details' },
                      { method: 'DELETE', path: '/tasks/:id', desc: 'Delete a task' },
                      { method: 'GET', path: '/sections', desc: 'Fetch sections for a project' },
                      { method: 'POST', path: '/sections', desc: 'Create a new section' },
                      { method: 'PATCH', path: '/sections/:id', desc: 'Update section details' },
                      { method: 'DELETE', path: '/sections/:id', desc: 'Delete a section' },
                      { method: 'GET', path: '/users', desc: 'Fetch all users' },
                      { method: 'POST', path: '/users', desc: 'Create a new user' },
                      { method: 'PATCH', path: '/users/:id', desc: 'Update user details' },
                      { method: 'DELETE', path: '/users/:id', desc: 'Delete a user' },
                      { method: 'POST', path: '/comments', desc: 'Add a comment/log to task/subtask' },
                      { method: 'DELETE', path: '/comments/:id', desc: 'Delete a comment' },
                    ].map((api, i) => (
                      <div key={i} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-emerald-100 hover:bg-emerald-50/30 transition-all group">
                        <span className={`text-[10px] font-black px-3 py-1 rounded-lg w-16 text-center ${
                          api.method === 'GET' ? 'bg-emerald-100 text-emerald-700' : 
                          api.method === 'POST' ? 'bg-emerald-600 text-white' : 
                          api.method === 'PATCH' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {api.method}
                        </span>
                        <code className="text-sm font-bold text-slate-700">{api.path}</code>
                        <span className="text-sm text-slate-500 ml-auto">{api.desc}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div className="p-8 bg-slate-50 border-t border-slate-100">
                <p className="text-center text-xs text-slate-400 font-medium">
                  &copy; 2026 Roots Task Management. Built with React & Emerald Design System.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-8"
            onClick={(e) => e.target === e.currentTarget && setIsAddingUser(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Create New User</h2>
                  <p className="text-slate-500 font-medium">Add a Human or Digital Intelligence to your workspace</p>
                </div>

                <div className="space-y-6">
                  <div className="p-2 bg-slate-100 rounded-2xl flex gap-2">
                    <button 
                      onClick={() => {
                        setNewUserIsDI(false);
                        setNewUserType('Human User');
                      }}
                      className={`flex-grow py-3 px-4 rounded-xl font-bold text-sm transition-all ${!newUserIsDI ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Human
                    </button>
                    <button 
                      onClick={() => {
                        setNewUserIsDI(true);
                        setNewUserType('DI User');
                      }}
                      className={`flex-grow py-3 px-4 rounded-xl font-bold text-sm transition-all ${newUserIsDI ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      DI
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        type="text"
                        value={newUserFirstName}
                        onChange={(e) => setNewUserFirstName(e.target.value)}
                        placeholder="e.g. John"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    {!newUserIsDI && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                        <input 
                          type="text"
                          value={newUserLastName}
                          onChange={(e) => setNewUserLastName(e.target.value)}
                          placeholder="e.g. Smith"
                          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      type="email"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="tel"
                      value={newUserPhone}
                      onChange={(e) => setNewUserPhone(e.target.value)}
                      placeholder="e.g. +1 555 0123"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">User Type</label>
                    <select 
                      value={newUserType}
                      onChange={(e) => setNewUserType(e.target.value as any)}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {!newUserIsDI ? (
                        <>
                          <option value="Human Super Admin">Human Super Admin</option>
                          <option value="Human Admin">Human Admin</option>
                          <option value="Human User">Human User</option>
                        </>
                      ) : (
                        <>
                          <option value="DI Super Admin">DI Super Admin</option>
                          <option value="DI Admin">DI Admin</option>
                          <option value="DI User">DI User</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setIsAddingUser(false)}
                    className="flex-grow py-4 border border-slate-200 text-slate-600 rounded-[20px] font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={addUser}
                    className="flex-grow py-4 bg-emerald-600 text-white rounded-[20px] font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                  >
                    Create User
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-8"
            onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[40px] w-full max-w-lg p-10 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full -mr-16 -mt-16 opacity-50" />
              <div className="relative z-10 space-y-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-slate-900">Edit User</h2>
                  <p className="text-slate-500 font-medium">Modify operator or Digital Intelligence settings</p>
                </div>

                <div className="space-y-6">
                  <div className="p-2 bg-slate-100 rounded-2xl flex gap-2">
                    <button 
                      onClick={() => {
                        setEditingUserIsDI(false);
                        setEditingUserType('Human User');
                      }}
                      className={`flex-grow py-3 px-4 rounded-xl font-bold text-sm transition-all ${!editingUserIsDI ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      Human
                    </button>
                    <button 
                      onClick={() => {
                        setEditingUserIsDI(true);
                        setEditingUserType('DI User');
                      }}
                      className={`flex-grow py-3 px-4 rounded-xl font-bold text-sm transition-all ${editingUserIsDI ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      DI
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">First Name</label>
                      <input 
                        type="text"
                        value={editingUserFirstName}
                        onChange={(e) => setEditingUserFirstName(e.target.value)}
                        placeholder="e.g. John"
                        className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </div>
                    {!editingUserIsDI && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Last Name</label>
                        <input 
                          type="text"
                          value={editingUserLastName}
                          onChange={(e) => setEditingUserLastName(e.target.value)}
                          placeholder="e.g. Smith"
                          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                        />
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                    <input 
                      type="email"
                      value={editingUserEmail}
                      onChange={(e) => setEditingUserEmail(e.target.value)}
                      placeholder="e.g. user@example.com"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                    <input 
                      type="tel"
                      value={editingUserPhone}
                      onChange={(e) => setEditingUserPhone(e.target.value)}
                      placeholder="e.g. +1 555 0123"
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">User Type</label>
                    <select 
                      value={editingUserType}
                      onChange={(e) => setEditingUserType(e.target.value as any)}
                      className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-medium focus:ring-2 focus:ring-emerald-500/20"
                    >
                      {!editingUserIsDI ? (
                        <>
                          <option value="Human Super Admin">Human Super Admin</option>
                          <option value="Human Admin">Human Admin</option>
                          <option value="Human User">Human User</option>
                        </>
                      ) : (
                        <>
                          <option value="DI Super Admin">DI Super Admin</option>
                          <option value="DI Admin">DI Admin</option>
                          <option value="DI User">DI User</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    onClick={() => setEditingUser(null)}
                    className="flex-grow py-4 border border-slate-200 text-slate-600 rounded-[20px] font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={editUser}
                    className="flex-grow py-4 bg-emerald-600 text-white rounded-[20px] font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
