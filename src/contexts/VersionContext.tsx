import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Version {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

interface VersionContextType {
  versions: Version[];
  activeVersion: Version | null;
  loading: boolean;
  setActiveVersion: (version: Version) => Promise<void>;
  createVersion: (name: string) => Promise<void>;
  loadVersions: () => Promise<void>;
}

const VersionContext = createContext<VersionContextType | undefined>(undefined);

export const VersionProvider = ({ children }: { children: ReactNode }) => {
  const [versions, setVersions] = useState<Version[]>([]);
  const [activeVersion, setActiveVersionState] = useState<Version | null>(null);
  const [loading, setLoading] = useState(true);

  const loadVersions = async () => {
    const { data, error } = await supabase
      .from('versions')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading versions:', error);
      return;
    }

    setVersions(data || []);
    const active = data?.find(v => v.is_active);
    if (active) {
      setActiveVersionState(active);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const setActiveVersion = async (version: Version) => {
    // Deactivate all versions
    await supabase
      .from('versions')
      .update({ is_active: false })
      .neq('id', '');

    // Activate selected version
    const { error } = await supabase
      .from('versions')
      .update({ is_active: true })
      .eq('id', version.id);

    if (error) {
      toast.error('فشل في تغيير النسخة');
      return;
    }

    setActiveVersionState(version);
    toast.success(`تم التبديل إلى نسخة: ${version.name}`);
    await loadVersions();
  };

  const createVersion = async (name: string) => {
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم النسخة');
      return;
    }

    // Deactivate all versions
    await supabase
      .from('versions')
      .update({ is_active: false })
      .neq('id', '');

    // Create new version and set it as active
    const { data, error } = await supabase
      .from('versions')
      .insert({ name: name.trim(), is_active: true })
      .select()
      .single();

    if (error) {
      toast.error('فشل في إنشاء النسخة');
      return;
    }

    toast.success(`تم إنشاء نسخة جديدة: ${name}`);
    setActiveVersionState(data);
    await loadVersions();
  };

  return (
    <VersionContext.Provider value={{ versions, activeVersion, loading, setActiveVersion, createVersion, loadVersions }}>
      {children}
    </VersionContext.Provider>
  );
};

export const useVersion = () => {
  const context = useContext(VersionContext);
  if (!context) {
    throw new Error('useVersion must be used within a VersionProvider');
  }
  return context;
};
