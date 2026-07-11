<script setup>
</script>
<template>
  <UApp :toaster="{ position: 'top-center', expand: false }">
    <AppHeader/>

    <UMain :ui="{main:{base:'min-h-[calc(100vh-var(--ui-header-height))]'}}">
      <UContainer>
        <slot/>
      </UContainer>
    </UMain>

    <AppFooter/>
  </UApp>
</template>
