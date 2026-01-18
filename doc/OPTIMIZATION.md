# 性能优化文档

本文档记录了 XiaoShiLiu 项目的性能优化改进，按照高性能收益和低风险的优先级排序实施。

## 优化概述

### 1. N+1 查询问题优化

#### 问题描述
在获取评论列表时，原有代码对每个评论都进行单独的数据库查询来检查点赞状态和子评论数量，导致 N+1 查询问题。

#### 解决方案
使用批量查询替代循环内单个查询：
- 批量获取点赞状态：使用 `prisma.like.findMany` 一次性获取所有评论的点赞状态
- 批量获取子评论数量：使用 `prisma.comment.groupBy` 一次性统计所有评论的回复数

#### 影响范围
- `routes/comments.js`: 获取评论列表、获取子评论列表
- `routes/posts.js`: 获取笔记评论列表

#### 性能收益
- 将 O(N) 次数据库查询减少为常数次查询
- 对于 20 条评论的列表，从约 40 次查询减少到 3-4 次查询

---

### 2. 推荐算法查询优化

#### 问题描述
推荐服务 (`getRecommendedPosts`) 和热门服务 (`getHotPosts`) 原有实现会加载所有符合条件的帖子到内存中，然后进行排序和分页，对于大数据集非常低效。

#### 解决方案
引入**候选池策略**：
- 限制候选池大小，避免全表加载
- 使用 `page * limit * multiplier` 动态计算候选池大小
- 设置最大候选池上限（推荐 500，热门 300）
- 在候选池内应用推荐/热门算法进行评分和排序

#### 配置参数
配置统一定义在 `utils/recommendationService.js` 中：
```javascript
// 候选池配置（用于限制内存使用和提高查询效率）
const CANDIDATE_POOL_CONFIG = {
  MULTIPLIER: 5,        // 候选池大小倍率
  MAX_RECOMMENDED: 500, // 推荐服务最大候选池
  MAX_HOT: 300          // 热门服务最大候选池
};
```

#### 性能收益
- 显著减少内存使用
- 对于大数据集，查询时间从 O(N) 降低到 O(1)
- 保持推荐质量（通过合理的候选池大小）

---

### 3. 内存缓存系统

#### 问题描述
标签、分类等低变更频率的数据在每次请求时都需要查询数据库。

#### 解决方案
实现简单的内存缓存工具 (`utils/cache.js`)：
- 支持 TTL（过期时间）
- 支持自动清理
- 支持前缀匹配失效
- 提供 `getOrSet` 便捷方法

#### 缓存配置
```javascript
const CACHE_TTL = {
  CATEGORIES: 10 * 60 * 1000,      // 分类缓存10分钟
  TAGS_POPULAR: 5 * 60 * 1000,      // 热门标签缓存5分钟
  USER_STATS: 1 * 60 * 1000,        // 用户统计缓存1分钟
  SYSTEM_SETTINGS: 30 * 60 * 1000   // 系统设置缓存30分钟
};
```

#### 应用范围
- `routes/tags.js`: 标签列表、热门标签
- 缓存失效：创建笔记、更新笔记、删除笔记时自动失效标签缓存

#### 性能收益
- 减少重复的数据库查询
- 对于高频访问的低变更数据，响应时间显著降低

---

### 4. 用户行为数据查询优化

#### 问题描述
`getUserBehaviorData` 函数中返回了未使用的 `created_at` 和 `updated_at` 字段。

#### 解决方案
使用精确的 `select` 语句，只返回必要的字段。

#### 性能收益
- 减少数据传输量
- 降低序列化/反序列化开销

---

### 5. 标签处理批量优化

#### 问题描述
创建、更新笔记时，对每个标签都进行单独的 `findUnique` 查询和 `create` 操作。

#### 解决方案
实现四步批量操作策略：
1. **批量查询现有标签**：使用 `findMany` 一次性查询所有需要的标签
2. **创建缺失标签**：仅对不存在的标签进行创建
3. **批量创建关联**：使用 `createMany` 批量创建 postTag 关联
4. **批量更新计数**：使用 `updateMany` 一次性更新所有标签的 use_count

#### 代码示例
```javascript
// Step 1: Batch query existing tags
const existingTags = await prisma.tag.findMany({
  where: { name: { in: tags } },
  select: { id: true, name: true }
});
const existingTagMap = new Map(existingTags.map(t => [t.name, t.id]));

// Step 2: Create missing tags
const missingTagNames = tags.filter(name => !existingTagMap.has(name));
for (const name of missingTagNames) {
  const newTag = await prisma.tag.create({ data: { name } });
  existingTagMap.set(name, newTag.id);
}

// Step 3: Batch create postTag associations
const tagIds = tags.map(name => existingTagMap.get(name));
await prisma.postTag.createMany({
  data: tagIds.map(tag_id => ({ post_id: postId, tag_id })),
  skipDuplicates: true
});

// Step 4: Batch update tag counts
await prisma.tag.updateMany({
  where: { id: { in: tagIds } },
  data: { use_count: { increment: 1 } }
});
```

#### 性能收益
- 对于 N 个标签：从 3N 次查询减少到 2 + M 次查询（M 为新标签数量）
- 使用 `createMany` 批量创建关联记录
- 使用 `updateMany` 批量更新计数

---

## 兼容性说明

所有优化都保持了 API 接口的完全兼容性：
- 响应格式保持不变
- 业务逻辑保持不变
- 数据库结构无需修改

## 未来优化建议

### 阶段2：中等风险优化
- [x] 使用 `updateMany` 批量更新标签计数
- [x] 使用 `createMany` 批量创建标签关联
- [x] 使用批量查询优化标签处理
- [ ] 添加数据库连接池配置优化
- [ ] 实现 Redis 缓存支持（可选）

### 阶段3：低优先级优化
- [ ] 添加请求响应压缩
- [ ] 实现 API 响应缓存中间件
- [ ] 添加慢查询日志和监控

## 测试建议

1. **功能测试**：确保所有 API 端点返回正确的数据
2. **性能测试**：使用 Artillery 或 k6 进行负载测试
3. **数据一致性测试**：验证缓存失效逻辑正确工作
