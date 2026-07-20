<script setup lang="ts">
import type { Rule, RuleGroup } from '../../shared/domain'

const api = useApi()

const groups = ref<RuleGroup[]>([])
const rules = ref<Rule[]>([])
const selId = ref<string | null>(null)
const newGroup = ref('')
const newRuleName = ref('')
const newRuleGroup = ref<string>('')

async function reload() {
  groups.value = await api.rules.listGroups()
  rules.value = await api.rules.list()
}
onMounted(reload)

const selected = computed(() => rules.value.find((r) => r.id === selId.value) ?? null)
const rulesOf = (gid: string) => rules.value.filter((r) => r.groupId === gid)

async function addGroup() {
  const n = newGroup.value.trim()
  if (!n) return
  await api.rules.createGroup(n)
  newGroup.value = ''
  await reload()
}
async function addRule() {
  const n = newRuleName.value.trim()
  if (!n || !newRuleGroup.value) return
  const created = await api.rules.create(newRuleGroup.value, n)
  newRuleName.value = ''
  await reload()
  selId.value = created.id
}
</script>

<template>
  <div class="flex items-stretch h-screen">
    <!-- 群組 + 規則清單 -->
    <div class="w-[300px] shrink-0 p-4 border-r border-default overflow-y-auto">
      <h2 class="text-base font-bold mb-3">交易規則</h2>
      <div class="flex gap-2 mb-4">
        <input
          v-model="newGroup"
          placeholder="新增群組"
          class="flex-1 rounded-md border border-default bg-default px-2 py-1 text-xs"
          @keydown.enter="addGroup"
        />
        <UButton size="xs" @click="addGroup">＋</UButton>
      </div>

      <div class="flex flex-col gap-4">
        <div v-for="g in groups" :key="g.id">
          <p class="text-xs uppercase text-dimmed font-bold mb-1.5">{{ g.name }}</p>
          <div class="flex flex-col gap-0.5">
            <span
              v-for="r in rulesOf(g.id)"
              :key="r.id"
              class="text-sm px-2 py-1 rounded-md cursor-pointer"
              :class="r.id === selId ? 'bg-primary/10 text-primary' : ''"
              @click="selId = r.id"
              >{{ r.name }}</span
            >
          </div>
        </div>
      </div>

      <div v-if="groups.length > 0" class="border border-default rounded-lg p-2 mt-6">
        <p class="text-xs text-dimmed mb-1.5">新增規則</p>
        <div class="flex flex-col gap-2">
          <select
            v-model="newRuleGroup"
            class="rounded-md border border-default bg-default px-2 py-1 text-xs"
          >
            <option value="" disabled>選群組</option>
            <option v-for="g in groups" :key="g.id" :value="g.id">{{ g.name }}</option>
          </select>
          <input
            v-model="newRuleName"
            placeholder="規則名稱"
            class="rounded-md border border-default bg-default px-2 py-1 text-xs"
            @keydown.enter="addRule"
          />
          <UButton size="xs" :disabled="!newRuleGroup" @click="addRule">新增規則</UButton>
        </div>
      </div>
    </div>

    <!-- 編輯區 -->
    <div class="flex-1 overflow-y-auto p-6">
      <RuleEditor v-if="selected" :key="selected.id" :rule="selected" @changed="reload" />
      <p v-else class="text-dimmed">選一條規則以編輯，或先新增群組與規則。</p>
    </div>
  </div>
</template>
