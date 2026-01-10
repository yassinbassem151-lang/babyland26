import { useState } from 'react';
import { Layers, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useVersion } from '@/contexts/VersionContext';

const VersionSelector = () => {
  const { versions, activeVersion, setActiveVersion, createVersion, loading } = useVersion();
  const [newVersionName, setNewVersionName] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleCreateVersion = async () => {
    await createVersion(newVersionName);
    setNewVersionName('');
    setDialogOpen(false);
  };

  if (loading) {
    return <div className="p-2 text-sm text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="p-4 border-b border-border">
      <div className="flex items-center gap-2 mb-2">
        <Layers className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">النسخة الحالية</span>
      </div>
      
      <div className="space-y-2">
        {versions.map((version) => (
          <button
            key={version.id}
            onClick={() => setActiveVersion(version)}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all ${
              version.is_active
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <span>{version.name}</span>
            {version.is_active && <Check className="h-4 w-4" />}
          </button>
        ))}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full gap-2 mt-2">
              <Plus className="h-4 w-4" />
              نسخة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إنشاء نسخة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>اسم النسخة</Label>
                <Input
                  placeholder="مثال: يناير 2025"
                  value={newVersionName}
                  onChange={(e) => setNewVersionName(e.target.value)}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                سيتم إنشاء نسخة جديدة فارغة وسيبدأ ترقيم الطلبات من 1
              </p>
              <Button onClick={handleCreateVersion} className="w-full">
                إنشاء النسخة
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default VersionSelector;
