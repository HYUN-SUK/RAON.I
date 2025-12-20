import { ContentBoardList } from '@/components/community/content/ContentBoardList';

export default function CreatorContentListPage() {
    return (
        <div className="min-h-screen bg-[#F7F5EF]">
            <div className="pb-4">
                {/* Note: Header is handled by layout or component depending on structure. 
            Here we assume the component handles its filters and layout mostly.
        */}
                <ContentBoardList />
            </div>
        </div>
    );
}
