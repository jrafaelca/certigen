<template>
  <UHeader>
    <template #title>
      <AppLogo/>
    </template>

    <template #right>
      <UColorModeButton/>

      <UTooltip text="Open on GitHub">
        <UButton
            color="neutral"
            variant="ghost"
            to="https://github.com/jrafaelca/certigen"
            target="_blank"
            icon="i-simple-icons-github"
            aria-label="GitHub"
        />
      </UTooltip>
    </template>
  </UHeader>
</template>
