
CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.task_status AS ENUM ('to_do', 'in_progress', 'done', 'overdue');

CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE,
  priority task_priority NOT NULL DEFAULT 'medium',
  status task_status NOT NULL DEFAULT 'to_do',
  assigned_to TEXT,
  linked_area TEXT,
  linked_camp_id UUID REFERENCES public.camps(id) ON DELETE SET NULL,
  linked_coach_id UUID REFERENCES public.coaches(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to tasks"
  ON public.tasks
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
