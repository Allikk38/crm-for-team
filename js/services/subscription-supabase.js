// js/services/subscription-supabase.js
export async function getUserSubscription() {
    const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single();
    return data;
}

export async function activateModule(userId, moduleId) {
    // Проверяем, доступен ли модуль по тарифу или куплен отдельно
    const subscription = await getUserSubscription(userId);
    const purchased = await checkPurchasedModule(userId, moduleId);
    
    if (isModuleInPlan(moduleId, subscription.plan_type) || purchased) {
        // Добавляем permission_set пользователю
        await grantModulePermissions(userId, moduleId);
        return true;
    }
    return false;
}