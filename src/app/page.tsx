import { Editor } from '@/editor';
import { ProjectHome } from '@/features/project/project-home';

export default async function Home({ searchParams }: { searchParams: Promise<{ scene?: string; project?: string; room?: string }> }) {
  const query = await searchParams;
  // Existing scene and room links continue to open the editor.
  return query.scene || query.project || query.room ? <Editor /> : <ProjectHome />;
}
