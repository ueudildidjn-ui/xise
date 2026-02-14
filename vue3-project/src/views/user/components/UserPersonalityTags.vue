<template>
    <div class="personality-tags" v-if="hasVisibleTags">
        <span v-for="(tag, index) in visibleTags" :key="index" class="tag">
            <SvgIcon v-if="index === 0 && showGenderIcon" :name="genderIcon" width="14" height="14"
                class="gender-icon" />
            {{ tag }}
        </span>
    </div>
</template>

<script setup>
import { computed } from 'vue'
import SvgIcon from '@/components/SvgIcon.vue'

const props = defineProps({
    userInfo: {
        type: Object,
        default: () => ({})
    }
})

// 性别图标映射
const genderIcons = {
    '男': 'male',
    '女': 'female'
}

// 计算可见的标签
const visibleTags = computed(() => {
    const tags = []
    const userInfo = props.userInfo

    if (!userInfo) return tags

    // 计算年龄（从birthday）
    if (userInfo.birthday) {
        try {
            const birth = new Date(userInfo.birthday)
            if (!isNaN(birth.getTime())) {
                const now = new Date()
                let age = now.getFullYear() - birth.getFullYear()
                const m = now.getMonth() - birth.getMonth()
                if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                    age--
                }
                if (age > 0 && age < 150) {
                    tags.push(`${age}岁`)
                }
            }
        } catch {
            // 忽略无效日期
        }
    }

    // 按顺序检查各个标签字段（已移除education和major）
    const tagFields = [
        { key: 'zodiac_sign', label: userInfo.zodiac_sign },
        { key: 'mbti', label: userInfo.mbti }
    ]

    // 添加非空的标签
    tagFields.forEach(field => {
        if (field.label && field.label.trim()) {
            tags.push(field.label)
        }
    })

    // 添加兴趣爱好标签
    const interests = userInfo.interests || ''
    let interestArray = []

    if (typeof interests === 'string') {
        if (interests.trim()) {
            try {
                // 尝试解析为JSON数组
                const parsed = JSON.parse(interests)
                interestArray = Array.isArray(parsed) ? parsed : []
            } catch {
                // 如果不是JSON格式，按逗号分割
                interestArray = interests.split(',').map(item => item.trim()).filter(item => item)
            }
        } else {
            interestArray = []
        }
    } else if (Array.isArray(interests)) {
        // 如果是数组，直接使用
        interestArray = interests
    }

    interestArray.forEach(interest => {
        if (interest && interest.trim()) {
            tags.push(interest)
        }
    })

    // 添加自定义字段标签
    const customFields = userInfo.custom_fields
    if (customFields && typeof customFields === 'object') {
        Object.values(customFields).forEach(val => {
            if (val && String(val).trim()) {
                tags.push(String(val))
            }
        })
    }

    return tags
})

// 性别图标
const genderIcon = computed(() => {
    const userInfo = props.userInfo
    return userInfo.gender && genderIcons[userInfo.gender] ? genderIcons[userInfo.gender] : null
})

// 是否显示性别图标
const showGenderIcon = computed(() => {
    return visibleTags.value.length > 0 && genderIcon.value
})

// 是否有可见标签
const hasVisibleTags = computed(() => {
    return visibleTags.value.length > 0
})
</script>

<style scoped>
.personality-tags {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 0 16px;
}

/* 大屏幕下移除左右边距 */
@media (min-width: 901px) {
    .personality-tags {
        padding: 0;
    }
}

.tag {
    display: inline-flex;
    align-items: center;
    padding: 4px 8px;
    background-color: var(--bg-color-secondary);
    color: var(--text-color-secondary);
    border-radius: 12px;
    font-size: 12px;
    line-height: 1.2;
    white-space: nowrap;
    border: 1px solid var(--border-color-primary);
    transition: all 0.2s ease;
}

.tag .gender-icon {
    margin-right: 4px;
    color: var(--text-color-secondary);
}



/* 响应式设计 */
@media (max-width: 480px) {
    .personality-tags {
        gap: 6px;
        padding: 0 16px;
    }

    .tag {
        padding: 3px 6px;
        font-size: 11px;
    }
}
</style>