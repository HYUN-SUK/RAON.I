import PricingConfigEditor from '@/components/admin/PricingConfigEditor';

export default function AdminRatePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">가격 및 시즌 정책</h1>
            <p className="text-gray-500">
                기본 요금, 성수기 시즌, 추가 요금 정책을 관리합니다.<br />
                모든 변경사항은 <strong>저장 즉시 사용자 화면에 반영</strong>됩니다.
            </p>

            <PricingConfigEditor />
        </div>
    );
}
