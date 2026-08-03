use std::{any::Any, fmt::Debug, sync::Arc};

use serde::Serialize;
use turbo_tasks::{
    NonLocalValue,
    debug::ValueDebugFormat,
    trace::{TraceRawVcs, TraceRawVcsContext},
};

pub trait UpdateInstruction:
    erased_serde::Serialize + Debug + Send + Sync + NonLocalValue + TraceRawVcs + 'static
{
    fn as_any(&self) -> &dyn Any;
    fn eq(&self, other: &dyn Any) -> bool;
}

impl<T> UpdateInstruction for T
where
    T: Serialize + Eq + Debug + Send + Sync + NonLocalValue + TraceRawVcs + 'static,
{
    fn as_any(&self) -> &dyn Any {
        self
    }

    fn eq(&self, other: &dyn Any) -> bool {
        other.downcast_ref::<Self>() == Some(self)
    }
}

erased_serde::serialize_trait_object!(UpdateInstruction);

#[derive(Clone, Debug, Serialize, ValueDebugFormat, NonLocalValue)]
#[serde(transparent)]
pub struct UpdateInstructionValue(Arc<dyn UpdateInstruction>);

impl PartialEq for UpdateInstructionValue {
    fn eq(&self, other: &Self) -> bool {
        self.0.eq(other.0.as_any())
    }
}

impl Eq for UpdateInstructionValue {}

impl UpdateInstructionValue {
    pub fn new<T>(instruction: T) -> Self
    where
        T: Serialize + Eq + Debug + Send + Sync + NonLocalValue + TraceRawVcs + 'static,
    {
        Self(Arc::new(instruction))
    }

    pub fn downcast_ref<T: 'static>(&self) -> Option<&T> {
        UpdateInstruction::as_any(self.0.as_ref()).downcast_ref()
    }
}

impl TraceRawVcs for UpdateInstructionValue {
    fn trace_raw_vcs(&self, trace_context: &mut TraceRawVcsContext) {
        self.0.trace_raw_vcs(trace_context);
    }
}

#[cfg(test)]
mod tests {
    use serde::Serialize;
    use turbo_tasks::{NonLocalValue, trace::TraceRawVcs};

    use super::UpdateInstructionValue;

    #[derive(Debug, PartialEq, Eq, Serialize, TraceRawVcs, NonLocalValue)]
    struct TestInstruction {
        value: u32,
    }

    #[test]
    fn serializes_without_an_extra_wrapper() {
        let instruction = UpdateInstructionValue::new(TestInstruction { value: 42 });

        assert_eq!(
            serde_json::to_value(&instruction).unwrap(),
            serde_json::json!({ "value": 42 })
        );
    }

    #[test]
    fn downcasts_by_concrete_type() {
        let instruction = UpdateInstructionValue::new(TestInstruction { value: 42 });

        assert_eq!(
            instruction
                .downcast_ref::<TestInstruction>()
                .map(|instruction| instruction.value),
            Some(42)
        );
        assert!(instruction.downcast_ref::<serde_json::Value>().is_none());
        assert_eq!(
            instruction,
            UpdateInstructionValue::new(TestInstruction { value: 42 })
        );
    }
}
