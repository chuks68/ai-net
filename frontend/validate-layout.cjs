#!/usr/bin/env node

/**
 * Validation script for Issue #19 - Responsive Layout System
 */

console.log('🔍 Validating Responsive Layout System Implementation...\n')

const fs = require('fs')
const path = require('path')

const checks = {
  appShellExists: false,
  sidebarExists: false,
  topNavExists: false,
  mobileDrawerExists: false,
  breadcrumbExists: false,
  cssExists: false,
  framerMotionInstalled: false,
  localStorageImplemented: false,
  ariaCompliance: false,
  responsiveCSS: false
}

// Check if required files exist
const requiredFiles = [
  'src/components/layout/AppShell.tsx',
  'src/components/layout/Sidebar.tsx', 
  'src/components/layout/TopNav.tsx',
  'src/components/layout/MobileDrawer.tsx',
  'src/components/layout/Breadcrumb.tsx',
  'src/components/layout/AppShell.css',
  'src/components/layout/Sidebar.css',
  'src/components/layout/TopNav.css',
  'src/components/layout/MobileDrawer.css',
  'src/components/layout/Breadcrumb.css'
]

console.log('📁 Checking required files...')
requiredFiles.forEach(file => {
  if (fs.existsSync(path.join(__dirname, file))) {
    console.log(`✅ ${file}`)
    if (file.includes('AppShell.tsx')) checks.appShellExists = true
    if (file.includes('Sidebar.tsx')) checks.sidebarExists = true
    if (file.includes('TopNav.tsx')) checks.topNavExists = true
    if (file.includes('MobileDrawer.tsx')) checks.mobileDrawerExists = true
    if (file.includes('Breadcrumb.tsx')) checks.breadcrumbExists = true
    if (file.includes('.css')) checks.cssExists = true
  } else {
    console.log(`❌ ${file}`)
  }
})

// Check package.json for framer-motion
console.log('\n📦 Checking dependencies...')
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
if (packageJson.dependencies && packageJson.dependencies['framer-motion']) {
  console.log('✅ framer-motion installed')
  checks.framerMotionInstalled = true
} else {
  console.log('❌ framer-motion not found in dependencies')
}

// Check AppShell for localStorage implementation
console.log('\n💾 Checking localStorage implementation...')
const appShellContent = fs.readFileSync('src/components/layout/AppShell.tsx', 'utf8')
if (appShellContent.includes('sidebar_collapsed') && appShellContent.includes('localStorage')) {
  console.log('✅ localStorage implementation for sidebar state')
  checks.localStorageImplemented = true
} else {
  console.log('❌ localStorage implementation not found')
}

// Check for ARIA attributes
console.log('\n♿ Checking ARIA compliance...')
const ariaChecks = [
  { file: 'src/components/layout/TopNav.tsx', pattern: 'role="banner"' },
  { file: 'src/components/layout/Sidebar.tsx', pattern: 'role="navigation"' },
  { file: 'src/components/layout/Sidebar.tsx', pattern: 'aria-current' },
  { file: 'src/components/layout/MobileDrawer.tsx', pattern: 'aria-label' }
]

let ariaCompliant = true
ariaChecks.forEach(check => {
  if (fs.existsSync(check.file)) {
    const content = fs.readFileSync(check.file, 'utf8')
    if (content.includes(check.pattern)) {
      console.log(`✅ ${check.pattern} found in ${path.basename(check.file)}`)
    } else {
      console.log(`❌ ${check.pattern} missing in ${path.basename(check.file)}`)
      ariaCompliant = false
    }
  }
})
checks.ariaCompliance = ariaCompliant

// Check for responsive CSS
console.log('\n📱 Checking responsive design...')
const cssFiles = [
  'src/components/layout/AppShell.css',
  'src/components/layout/TopNav.css',
  'src/components/layout/Sidebar.css'
]

let responsiveFound = false
cssFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8')
    if (content.includes('@media (max-width: 767px)')) {
      console.log(`✅ Mobile breakpoint found in ${path.basename(file)}`)
      responsiveFound = true
    }
  }
})
checks.responsiveCSS = responsiveFound

// Summary
console.log('\n📊 VALIDATION SUMMARY')
console.log('=====================')

const passed = Object.values(checks).filter(Boolean).length
const total = Object.keys(checks).length

Object.entries(checks).forEach(([check, passed]) => {
  const icon = passed ? '✅' : '❌'
  const name = check.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  console.log(`${icon} ${name}`)
})

console.log(`\n🎯 Overall Score: ${passed}/${total} (${Math.round(passed/total * 100)}%)`)

if (passed === total) {
  console.log('\n🎉 All requirements fulfilled! Layout system is ready.')
} else {
  console.log('\n⚠️  Some requirements are missing. Please review the checklist above.')
}

process.exit(passed === total ? 0 : 1)
