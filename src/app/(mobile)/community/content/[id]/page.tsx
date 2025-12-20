import { ContentDetailView } from '@/components/community/content/ContentDetailView';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function ContentDetailPage({ params }: PageProps) {
    const { id } = await params;
    return <ContentDetailView contentId={id} />;
}
